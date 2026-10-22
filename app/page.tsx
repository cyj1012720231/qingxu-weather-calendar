'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Search, MapPin, Navigation, Settings2, Plus, Check, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Trash2, X, List, ArrowRight, RefreshCw, Info, WifiOff, CircleAlert, SlidersHorizontal, Star, ExternalLink, LocateFixed } from 'lucide-react';
import { type Location, type Preferences, type WeatherPoint, type ApiResult, defaultPreferences, parsePreferences, validLocation, locationLabel, tempText, localDate, localTime, isNight, weatherKind, percent, dayLabel } from '../lib/weather';
import { request, lookup, weatherUrl, getPosition, loadWeather, type WeatherSlot as Slot } from '../lib/weather-client';
import { WeatherIcon, SkyArt, Modal, Empty, Attribution, Freshness, Hourly, Daily, DataFields, WeatherChart, ForecastTrends, DailyChart, DailyRainChart, MetricCards, SectionTitle, Sun, Clock, CalendarDays } from '../components/weather-ui';

import { CalendarView } from '../components/calendar-view';
import { DateWeather } from '../components/date-weather';
import { PullToRefresh } from '../components/pull-to-refresh';
import { WeatherSelect } from '../components/weather-select';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { beijingToday } from '../lib/calendar/calendar.mjs';

const emptySlot:Slot={loading:false};
type ConnectionCheck={ok:boolean;code:string;message:string;checkedAt:string};
type Dialog='search'|'cities'|'settings'|'connection'|null;
const storageKey='qingxu.weather.v1';

export default function WeatherApp(){
 const [prefs,setPrefs]=useState<Preferences>(defaultPreferences),[cities,setCities]=useState<Location[]>([]),[place,setPlace]=useState<Location|null>(null),[located,setLocated]=useState<Location|null>(null),[ready,setReady]=useState(false);
 const [dialog,setDialog]=useState<Dialog>(null),[view,setView]=useState<'weather'|'details'|'calendar'>('calendar'),[toast,setToast]=useState(''),[locating,setLocating]=useState(false),[offline,setOffline]=useState(false),[configured,setConfigured]=useState<boolean|null>(null),[missing,setMissing]=useState<string[]>([]),[statusError,setStatusError]=useState('');
 const [current,setCurrent]=useState<Slot>(emptySlot),[daily,setDaily]=useState<Slot>(emptySlot),[hourly,setHourly]=useState<Slot>(emptySlot),[revision,setRevision]=useState(0),[now,setNow]=useState(''),[detail,setDetail]=useState<string|null>(null),[cityWeather,setCityWeather]=useState<Record<string,ApiResult>>({});
 const [checking,setChecking]=useState(false),[connection,setConnection]=useState<ConnectionCheck|null>(null);
 const [refreshPending,setRefreshPending]=useState(false),[detailLoading,setDetailLoading]=useState(false);
 const refreshGuard=useRef(false),lastWeatherRevision=useRef(0),lastCityRevision=useRef(0);
 const weatherActive=view!=='calendar'||detail!==null,overviewVisible=view==='weather'||view==='details';
 const refreshBusy=weatherActive&&(refreshPending||detailLoading||(overviewVisible&&(current.loading||daily.loading||hourly.loading)));
 const [calendarDate,setCalendarDate]=useState('');
 const previousToday=useRef('');
 // 跨北京时间午夜时，仅在仍选中旧今天的情况下跟进新日期。
 useEffect(()=>{if(!now)return;const today=beijingToday(new Date(now));if(!previousToday.current||today!==previousToday.current){const old=previousToday.current;setCalendarDate(date=>!old||date===old?today:date);previousToday.current=today;}},[now]);
 const statusSequence=useRef(0),connectionFeedback=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(dialog==='connection'&&!checking&&(connection||statusError))connectionFeedback.current?.scrollIntoView({block:'nearest'});},[dialog,checking,connection,statusError]);
 const selection=useRef(0),autoStarted=useRef(false),persistenceWarned=useRef(false);
 const notify=useCallback((message:string)=>setToast(message),[]);
 const choose=useCallback((location:Location)=>{selection.current++;setLocating(false);setPlace(location);setDialog(null);setView(v=>v==='details'?'weather':v);},[]);
 const locate=useCallback(async()=>{
  const seq=++selection.current;setLocating(true);
  try {const position=await getPosition();if(seq!==selection.current)return;
   const results=await lookup(`${position.coords.longitude.toFixed(2)},${position.coords.latitude.toFixed(2)}`);
   if(seq!==selection.current)return;if(!results.length)throw Error('已获取坐标，但没有解析到地点。请搜索城市或稍后重试。');
   const loc={...results[0],id:`gps:${position.coords.latitude.toFixed(2)},${position.coords.longitude.toFixed(2)}`,lat:position.coords.latitude,lon:position.coords.longitude,located:true};
   setLocated(loc);setPlace(loc);setDialog(null);setView(v=>v==='details'?'weather':v);
  }catch(e){if(seq===selection.current)notify(e instanceof Error?e.message:'定位失败，请手动选择城市。');}finally{if(seq===selection.current)setLocating(false);}
 },[notify]);
 const checkConnection=useCallback(async(verify=false)=>{
  const seq=++statusSequence.current;setChecking(true);if(verify)setConnection(null);
  try{
   const result=await request<{configured:boolean;missing:string[];connection?:ConnectionCheck}>(verify?'/api/status?check=1':'/api/status',AbortSignal.timeout(18000));
   if(seq!==statusSequence.current)return false;
   setConfigured(result.configured);setMissing(result.missing);setStatusError('');
   if(result.connection)setConnection(result.connection);
   return result.configured;
  }catch(e){if(seq===statusSequence.current)setStatusError(e instanceof DOMException&&e.name==='TimeoutError'?'检查连接超时，请稍后重试。':e instanceof Error?e.message:'无法检查服务状态');return false;}
  finally{if(seq===statusSequence.current)setChecking(false);}
 },[]);
 // 刷新锁覆盖连接检查与主请求，避免连续下拉重复发送请求。
 const refresh=useCallback(async(verify=false)=>{
  // 日历中检查连接只读取服务状态，不能顺带触发天气查询。
  if(!weatherActive){await checkConnection(verify);return;}
  if(refreshGuard.current||detailLoading)return;
  refreshGuard.current=true;setRefreshPending(true);
  const available=await checkConnection(verify);
  if(available&&place){setNow(new Date().toISOString());setRevision(v=>v+1);}
  else{setRefreshPending(false);refreshGuard.current=false;}
 },[checkConnection,detailLoading,place,weatherActive]);
 useEffect(()=>{
  try{const saved=JSON.parse(localStorage.getItem(storageKey)??'null');if(saved){setPrefs(parsePreferences(saved.prefs));if(Array.isArray(saved.cities))setCities(saved.cities.filter(validLocation));if(validLocation(saved.place))setPlace(saved.place);if(validLocation(saved.located))setLocated(saved.located);}}
  catch{notify('本地保存的设置无法读取，已使用默认设置。');}
  setReady(true);setNow(new Date().toISOString());setOffline(!navigator.onLine);void checkConnection();
  const network=()=>setOffline(!navigator.onLine);window.addEventListener('online',network);window.addEventListener('offline',network);
  const clock=setInterval(()=>setNow(new Date().toISOString()),60000);
  return()=>{clearInterval(clock);window.removeEventListener('online',network);window.removeEventListener('offline',network);};
 },[checkConnection,notify]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(storageKey,JSON.stringify({prefs,cities,place,located}));}catch{if(!persistenceWarned.current){persistenceWarned.current=true;notify('浏览器无法保存设置，本次会话仍可正常使用。');}}},[ready,prefs,cities,place,located,notify]);
 useEffect(()=>{if(weatherActive&&ready&&prefs.autoLocate&&configured===true&&!autoStarted.current){autoStarted.current=true;void locate();}},[weatherActive,ready,prefs.autoLocate,configured,locate]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(timer);},[toast]);
 useEffect(()=>{const force=lastWeatherRevision.current!==revision;lastWeatherRevision.current=revision;
  // 日历不加载天气；日期天气由对应页面单独查询，离开概览时取消在途请求。
  if(!overviewVisible){setRefreshPending(false);refreshGuard.current=false;return;}
  if(!place||configured!==true){setCurrent(emptySlot);setDaily(emptySlot);setHourly(emptySlot);setRefreshPending(false);refreshGuard.current=false;return;}
  const controller=new AbortController();
  // 手动刷新只替换返回的数据；切换城市仍取消旧请求并隔离旧结果。
  const load=(kind:string,set:typeof setCurrent)=>{const url=weatherUrl(place,kind);return loadWeather(url,()=>request<ApiResult>(url,controller.signal,force),controller.signal,set);};
  void Promise.all([load('current',setCurrent),load('daily',setDaily),load('hourly',setHourly)]).finally(()=>{if(!controller.signal.aborted){setRefreshPending(false);refreshGuard.current=false;}});
  return()=>controller.abort();
 },[place,configured,revision,overviewVisible]);
 useEffect(()=>{const force=lastCityRevision.current!==revision;lastCityRevision.current=revision;if(!overviewVisible||configured!==true||!cities.length)return;const controller=new AbortController();
  // 常用城市只请求实时天气，预报随实际切换按需获取。
  void(async()=>{for(const city of cities){if(controller.signal.aborted)return;try{const result=await request<ApiResult>(weatherUrl(city,'current'),controller.signal,force);if(!controller.signal.aborted)setCityWeather(old=>({...old,[city.id]:result}));}catch{ /* 列表温度缺失时保留占位；主视图提供重试信息。 */ }}})();return()=>controller.abort();
 },[cities,configured,revision,overviewVisible]);
 const c=current.result?.data,days=daily.result?.data.days??[],hours=hourly.result?.data.hours??[],tz=place?.tz??'Asia/Shanghai';
 const today=days.find(d=>localDate(d.forecastStartTime,tz)===localDate(now,tz));
 const night=isNight(today,now),kind=c?weatherKind(c.condition?.code):'unknown';
 const ambient=kind==='unknown'||night===null?'neutral':kind;
 const theme=prefs.theme==='dark'?'dark':prefs.theme==='light'?'light':night===true?'dark':'light';
 // 挂载后才按设备能力降级动画，确保服务端与浏览器的首屏 HTML 一致。
 const lowPower=ready&&typeof navigator!=='undefined'&&((navigator.hardwareConcurrency??8)<=4||(navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData);
 const animate=prefs.animation&&!lowPower;
 const saved=!!place&&cities.some(x=>x.id===place.id);
 function savePlace(){if(!place)return;if(saved){setCities(list=>list.filter(x=>x.id!==place.id));notify('已从常用城市移除');}else{setCities(list=>[...list,place]);notify('已加入常用城市');}}
 function moveCity(index:number,delta:number){setCities(old=>{const next=[...old];if(index+delta<0||index+delta>=old.length)return old;[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});}
 const message=!place?'请先选择城市':configured===false?'天气服务尚未连接':statusError||'暂无可用天气数据';
 const fullCurrentError=current.error;
 return <div className={`weather-app ${view==='calendar'?'is-calendar':''} ambient-${ambient} theme-${theme} ${night===true?'is-night':''} ${animate?'with-motion':'no-motion'}`}>
  <div className="sky-background" aria-hidden="true"><div className="sky-glow"/>{kind==='cloudy'&&<><div className="sky-cloud cloud-one"/><div className="sky-cloud cloud-two"/></>}{night===true&&<div className="stars"/>}{['rain','storm','snow'].includes(kind)&&<div className={`particles ${kind}`}>{Array.from({length:lowPower?10:24},(_,i)=><i key={i} style={{'--i':i} as CSSProperties}/>)}</div>}</div>
  <a href="#main" className="skip-link">跳到主要内容</a>
  <aside className="sidebar">
   <a className="brand" href="#" onClick={e=>{e.preventDefault();setView('calendar');window.scrollTo({top:0});}} aria-label="晴序首页"><span className="brand-mark"><Sun size={28} strokeWidth={1.6}/></span><span>晴序<small>WEATHER & CALENDAR.</small></span></a>
   <button className="search-trigger" onClick={()=>setDialog('search')}><Search size={17}/><span>搜索城市或地区</span><kbd>⌕</kbd></button>
   <nav className="side-navigation" aria-label="主要导航"><button className={view==='weather'?'active':''} onClick={()=>setView('weather')}><Sun size={18}/>天气概览</button><button className={view==='details'?'active':''} onClick={()=>setView('details')}><SlidersHorizontal size={18}/>详细天气<ChevronRight size={14}/></button></nav>
   <div className="sidebar-label"><span>我的城市</span><button className="icon-button small" onClick={()=>setDialog('cities')} aria-label="管理常用城市"><List size={16}/></button></div>
   <button className={`location-tile ${place?.located?'selected':''}`} onClick={()=>located?choose(located):void locate()} disabled={locating}><Navigation size={17}/><div><b>当前位置</b><small>{locating?'正在定位…':located?locationLabel(located):'点击定位'}</small></div>{locating?<RefreshCw size={15} className="spin"/>:<ChevronRight size={14}/>}</button>
   <div className="saved-city-list">{cities.map(city=><button className={`saved-city ${place?.id===city.id?'selected':''}`} key={city.id} onClick={()=>choose(city)}><span><b>{city.name}</b><small>{city.adm2||city.country}{cityWeather[city.id]?.stale?' · 缓存':''}</small></span><span className="city-temp">{tempText(cityWeather[city.id]?.data.temperature,prefs)}</span></button>)}{!cities.length&&<div className="saved-empty"><MapPin size={21} strokeWidth={1.3}/><p>暂无常用城市</p></div>}</div>
   <button className="add-city-button" onClick={()=>setDialog('search')}><Plus size={17}/>添加城市</button>
   <div className="sidebar-bottom"><button onClick={()=>setDialog('settings')}><Settings2 size={17}/>偏好设置</button></div>
  </aside>
  <PullToRefresh className="main-shell" refreshing={refreshBusy} disabled={!weatherActive||!!dialog||!!detail||!place} onRefresh={refresh}>
   <header className="topbar"><button className="mobile-brand" onClick={()=>{setView('calendar');window.scrollTo({top:0});}} aria-label="晴序首页"><Sun size={22}/>晴序</button><div className="breadcrumb"><MapPin size={14}/>{place?locationLabel(place):'选择城市'}</div><div className="top-actions"><span className="local-clock">{now?localTime(now,tz):'—'} {place?'当地':''}</span>{weatherActive&&<button className="icon-button" aria-label="刷新天气" disabled={refreshBusy||!place} onClick={()=>void refresh()}><RefreshCw size={18} className={refreshBusy?'refresh-spinning':''}/></button>}<button className="icon-button" aria-label="使用当前位置" onClick={()=>void locate()} disabled={locating}><LocateFixed size={19} className={locating?'spin':''}/></button><button className="icon-button" aria-label="搜索城市" onClick={()=>setDialog('search')}><Search size={19}/></button><button className="icon-button" aria-label="城市列表" onClick={()=>setDialog('cities')}><List size={20}/></button><button className="icon-button" aria-label="设置" onClick={()=>setDialog('settings')}><Settings2 size={19}/></button></div></header>
   <main id="main" className="main-content">
    {weatherActive&&offline&&<div className="status-banner" role="status"><WifiOff size={17}/><span>当前处于离线状态，正在显示已有天气数据。</span></div>}
    {weatherActive&&configured===false&&<div className="connection-banner"><span className="status-dot"/><span>天气服务尚未连接</span><button onClick={()=>setDialog('connection')}>连接说明<ArrowUpRightIcon/></button></div>}
    {weatherActive&&statusError&&<div className="status-banner" role="status"><CircleAlert size={17}/><span>{statusError}</span><button onClick={()=>void refresh()}>重试</button></div>}
    {view==='calendar'?(calendarDate?<CalendarView selected={calendarDate} onSelect={setCalendarDate} onWeather={date=>{setCalendarDate(date);setDetail(date);}} now={now}/>:null):view==='weather'?<>
    <section className={`weather-hero ${!place?'welcome-hero':''}`} aria-label="当前天气">
     {!place?<><SkyArt/><h1>选择城市，查看天气</h1><div className="hero-buttons"><button className="primary-button" onClick={()=>void locate()} disabled={locating}><Navigation size={17}/>{locating?'正在定位…':'使用当前位置'}</button><button className="secondary-button" onClick={()=>setDialog('search')}>选择城市<ArrowRight size={16}/></button></div><span className="location-privacy">仅在你允许时获取位置 · 城市偏好保存在本机</span></>:<><div className="hero-eyebrow">{place.located&&<Navigation size={12}/>} {place.located?'当前位置':'此刻天气'} · {now?localDate(now,tz):''}</div><div className="hero-city"><h1>{place.name}</h1><button className="icon-button" aria-label={saved?'取消收藏城市':'收藏城市'} onClick={savePlace}><Star size={19} fill={saved?'currentColor':'none'}/></button></div><div className={`hero-temperature ${current.loading&&!current.result?'pulse':''}`}>{tempText(c?.temperature,prefs)}</div><div className="hero-condition">{c?.condition?<><WeatherIcon code={c.condition.code} night={night===true} size={25}/>{c.condition.text??'天气现象未知'}</>:<span>{current.loading?'正在获取天气':configured===false?'等待天气服务连接':'暂无实时天气'}</span>}</div><p className="hero-range">最高 {tempText(today?.temperatureMax,prefs)}<span>·</span>最低 {tempText(today?.temperatureMin,prefs)}</p><p className="hero-feels">体感温度 {tempText(c?.feelsLike,prefs)}</p><Freshness result={current.result} tz={tz}/></>}
    </section>
    {fullCurrentError&&<div className="status-banner" role="status"><CircleAlert size={18}/><span>{fullCurrentError}</span><button onClick={()=>void refresh()}>重试</button></div>}
    {place&&<>
    <section className="glass hourly-card"><SectionTitle icon={Clock} title="逐小时预报"><button className="text-button" onClick={()=>setView('details')}>24 小时<ChevronRight size={14}/></button></SectionTitle>{hours.length?<><Hourly data={hours.slice(0,24)} prefs={prefs} tz={tz} days={days} onDetails={h=>setDetail(localDate(h.forecastTime,tz))}/><Freshness result={hourly.result} tz={tz}/></>:<Empty loading={hourly.loading} message={hourly.error??message} onRetry={hourly.error?()=>void refresh():undefined}/>}</section>
    <div className="forecast-grid"><section className="glass daily-card"><SectionTitle icon={CalendarDays} title="10 日天气预报"/>{days.length?<><Daily data={days.slice(0,10)} prefs={prefs} tz={tz} onDetails={d=>setDetail(localDate(d.forecastStartTime,tz))}/>{days.length<10&&<p className="small-note inset-note">仅有 {days.length} 天预报</p>}<Freshness result={daily.result} tz={tz}/></>:<Empty loading={daily.loading} message={daily.error??message} onRetry={daily.error?()=>void refresh():undefined}/>}<button className="card-footer-link" onClick={()=>setView('details')}>查看详细预报<ArrowRight size={15}/></button></section>
    <div className="metrics-column"><MetricCards current={c} day={today} prefs={prefs} tz={tz} now={now} onDetails={()=>setView('details')}/></div></div>
    <section className="glass trends-card"><SectionTitle icon={SlidersHorizontal} title="天气趋势"><button className="text-button" onClick={()=>setView('details')}>更多趋势<ChevronRight size={14}/></button></SectionTitle>{hours.length?<WeatherChart hours={hours.slice(0,24)} prefs={prefs} tz={tz}/>:<Empty loading={hourly.loading} message={hourly.error??message}/>}</section>
    </>}
    </>:<AdvancedWeather revision={revision} onLoadingChange={setDetailLoading} place={place} configured={configured} prefs={prefs} current={current} daily={daily} hourly={hourly} onBack={()=>setView('weather')} onSearch={()=>setDialog('search')} onDetail={data=>setDetail(localDate(data.forecastTime??data.forecastStartTime,tz))}/>}
    {view!=='calendar'&&<footer className="site-footer">{view==='weather'&&<Attribution results={[current.result,daily.result,hourly.result]}/>}<div><button onClick={()=>setDialog('connection')}>数据与连接<Info size={13}/></button></div></footer>}
   </main>
  </PullToRefresh>
  <button className="floating-view-button" type="button" aria-label={weatherActive?'切换到日历':'切换到天气'} title={weatherActive?'切换到日历':'切换到天气'} onClick={()=>{setView(weatherActive?'calendar':'weather');window.scrollTo({top:0});}}>
   {weatherActive?<CalendarDays size={26} strokeWidth={1.8}/>:<Sun size={26} strokeWidth={1.8}/>}
  </button>
  {toast&&<div className="toast" role="status"><Info size={17}/><span>{toast}</span><button aria-label="关闭提示" onClick={()=>setToast('')}><X size={16}/></button></div>}
  {dialog==='search'&&<SearchDialog onClose={()=>setDialog(null)} onChoose={choose} locate={locate} locating={locating} configured={configured}/>}
  {dialog==='settings'&&<Modal title="偏好设置" subtitle="偏好会自动保存在当前浏览器" onClose={()=>setDialog(null)}><div className="settings-list"><SettingRow label="温度单位"><div className="segmented">{(['C','F'] as const).map(u=><button key={u} onClick={()=>setPrefs({...prefs,temperature:u})} className={prefs.temperature===u?'active':''} aria-pressed={prefs.temperature===u}>°{u}</button>)}</div></SettingRow><SettingRow label="风速单位"><WeatherSelect label="风速单位" value={prefs.wind} onChange={value=>setPrefs({...prefs,wind:value as Preferences['wind']})} options={[{value:"km/h",label:"千米 / 小时"},{value:"m/s",label:"米 / 秒"},{value:"mph",label:"英里 / 小时"}]}/></SettingRow><SettingRow label="外观" note="自动模式跟随目标城市昼夜"><WeatherSelect label="外观" value={prefs.theme} onChange={value=>setPrefs({...prefs,theme:value as Preferences['theme']})} options={[{value:"auto",label:"自动"},{value:"light",label:"浅色"},{value:"dark",label:"深色"}]}/></SettingRow><SettingRow label="天气动态效果" note="始终尊重系统“减少动态效果”设置"><Switch className="weather-switch" aria-label="天气动态效果" checked={prefs.animation} onCheckedChange={animation=>setPrefs({...prefs,animation})}/></SettingRow><SettingRow label="进入时自动定位" note="需要浏览器允许位置权限"><Switch className="weather-switch" aria-label="进入时自动定位" checked={prefs.autoLocate} onCheckedChange={autoLocate=>setPrefs({...prefs,autoLocate})}/></SettingRow><button className="settings-link" onClick={()=>setDialog('cities')}><MapPin size={18}/>管理常用城市<ChevronRight size={17}/></button></div></Modal>}
  {dialog==='cities'&&<Modal title="常用城市" subtitle="收藏与排序保存在本机" onClose={()=>setDialog(null)}><div className="city-management"><button className="location-tile" onClick={()=>void locate()} disabled={locating}><Navigation size={20}/><span>{locating?'正在定位…':'更新当前位置'}</span><ChevronRight size={16}/></button>{cities.length?cities.map((city,i)=><div className="manage-city" key={city.id}><button className="manage-city-select" onClick={()=>choose(city)}><b>{city.name}</b><small>{locationLabel(city)}</small></button><span className="manage-temp">{tempText(cityWeather[city.id]?.data.temperature,prefs)}{cityWeather[city.id]?.stale&&<small>缓存</small>}</span><button className="icon-button small" onClick={()=>moveCity(i,-1)} disabled={i===0} aria-label={`上移${city.name}`}><ArrowUp size={16}/></button><button className="icon-button small" onClick={()=>moveCity(i,1)} disabled={i===cities.length-1} aria-label={`下移${city.name}`}><ArrowDown size={16}/></button><button className="icon-button small" aria-label={`删除${city.name}`} onClick={()=>setCities(v=>v.filter(c=>c.id!==city.id))}><Trash2 size={16}/></button></div>):<Empty message="还没有收藏的城市。选择地点后，点击城市旁的星标收藏。"/>}<button className="primary-button full-width" onClick={()=>setDialog('search')}><Plus size={17}/>添加城市</button></div></Modal>}
  {dialog==='connection'&&<Modal title="数据与连接" subtitle="天气数据由和风天气提供" onClose={()=>setDialog(null)}><div className="connection-details"><div className="connection-state"><span className={`status-dot ${configured?'connected':''}`}/>{checking?'正在检查天气服务…':configured===null?'尚未获取服务状态':configured?'服务端配置已就绪':'尚未读取到天气服务配置'}</div><details className="connection-config"><summary>服务器配置</summary><p>在服务端环境变量中配置以下项目，私钥仅保存在服务端。</p><dl className="config-fields"><dt>QWEATHER_API_HOST</dt><dd>和风控制台分配的专属地址</dd><dt>QWEATHER_KID</dt><dd>JWT 凭据 ID</dd><dt>QWEATHER_ISS</dt><dd>开发者 ID</dd><dt>QWEATHER_SUB</dt><dd>和风项目 ID</dd><dt>QWEATHER_PRIVATE_KEY</dt><dd>Ed25519 PKCS#8 私钥，仅服务端使用</dd></dl>{missing.length>0&&<p className="small-note">待配置：{missing.join('、')}</p>}<p className="small-note">修改配置后重启服务，再检查连接。</p></details><p>时间按城市时区显示，过期缓存会单独标记。</p><div className="connection-links"><a href="https://dev.qweather.com/docs/configuration/authentication/" target="_blank" rel="noreferrer">官方认证说明<ExternalLink size={14}/></a><a href="https://dev.qweather.com/docs/api/weather/" target="_blank" rel="noreferrer">天气数据文档<ExternalLink size={14}/></a></div><div ref={connectionFeedback}>{statusError&&<div className="connection-result failed" role="alert"><CircleAlert size={17}/><span>{statusError}</span></div>}{connection&&<div className={`connection-result ${connection.ok?'success':'failed'}`} role="status"><span>{connection.ok?<Check size={18}/>:<CircleAlert size={18}/>}</span><div><b>{connection.message}</b><small>检查时间：{new Date(connection.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）{!connection.ok&&` · ${connection.code}`}</small></div></div>}<button className="primary-button full-width" disabled={checking} aria-busy={checking} onClick={()=>void refresh(true)}><RefreshCw size={16} className={checking?'spin':''}/>{checking?'正在检查连接…':'重新检查连接'}</button></div></div></Modal>}
  {detail&&!dialog&&<DateWeather key={place?.id??'no-place'} date={detail} place={place} prefs={prefs} configured={configured} now={now} revision={revision} initialDaily={daily} onLoadingChange={setDetailLoading} onDateChange={date=>{setDetail(date);if(view==='calendar')setCalendarDate(date);}} onClose={()=>setDetail(null)} onSearch={()=>setDialog('search')} onConnection={()=>setDialog('connection')}/>}
 </div>;
}
function ArrowUpRightIcon(){return <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>;}
function SettingRow({label,note,children}:{label:string;note?:string;children:React.ReactNode}){return <div className="setting-row"><div><b>{label}</b>{note&&<small>{note}</small>}</div>{children}</div>;}

function SearchDialog({onClose,onChoose,locate,locating,configured}:{onClose:()=>void;onChoose:(l:Location)=>void;locate:()=>Promise<void>;locating:boolean;configured:boolean|null}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<Location[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[active,setActive]=useState(-1),[mode,setMode]=useState<'search'|'region'>('search'),[catalog,setCatalog]=useState<Location[]>([]),[province,setProvince]=useState(''),[city,setCity]=useState(''),[district,setDistrict]=useState(''),[catalogError,setCatalogError]=useState(''),[reload,setReload]=useState(0);
 const confirmController=useRef<AbortController|null>(null),searchSeq=useRef(0);
 useEffect(()=>()=>confirmController.current?.abort(),[]);
 useEffect(()=>{const controller=new AbortController();const seq=++searchSeq.current;setActive(-1);setResults([]);setError('');if(!query.trim()||mode!=='search'){setBusy(false);return()=>controller.abort();}
  setBusy(true);const timeout=setTimeout(async()=>{try{const list=await lookup(query.trim(),controller.signal);if(!controller.signal.aborted&&seq===searchSeq.current)setResults(list);}catch(e){if(!controller.signal.aborted&&seq===searchSeq.current)setError(e instanceof Error?e.message:'搜索失败');}finally{if(!controller.signal.aborted&&seq===searchSeq.current)setBusy(false);}},350);return()=>{clearTimeout(timeout);controller.abort();};
 },[query,mode]);
 useEffect(()=>{if(mode!=='region'||catalog.length)return;const controller=new AbortController();setCatalogError('');void request<Location[]>('/locations.json',controller.signal).then(list=>{if(!controller.signal.aborted)setCatalog(list.filter(validLocation));}).catch(()=>{if(!controller.signal.aborted)setCatalogError('地区目录加载失败，请重试。');});return()=>controller.abort();},[mode,catalog.length,reload]);
 const provinces=[...new Set(catalog.map(l=>l.adm1))],cityNames=[...new Set(catalog.filter(l=>l.adm1===province).map(l=>l.adm2))],districts=catalog.filter(l=>l.adm1===province&&l.adm2===city);
 async function confirmRegion(){const selected=districts.find(l=>l.id===district);if(!selected)return;confirmController.current?.abort();const controller=new AbortController();confirmController.current=controller;setBusy(true);setError('');try{const found=await lookup(selected.id,controller.signal);if(controller.signal.aborted)return;const exact=found.find(l=>l.id===selected.id);if(!exact)throw Error('此地点暂未得到在线确认，请使用城市搜索。');onChoose(exact);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'地点确认失败');}finally{if(!controller.signal.aborted)setBusy(false);}}
 return <Modal title="选择城市" subtitle="支持城市、区县及英文名称" onClose={onClose}><div className="search-content"><div className="segmented search-mode"><button className={mode==='search'?'active':''} disabled={busy&&mode==='region'} onClick={()=>{setMode('search');setError('');}} aria-pressed={mode==='search'}><Search size={15}/>搜索地点</button><button className={mode==='region'?'active':''} disabled={busy&&mode==='region'} onClick={()=>{setMode('region');setError('');}} aria-pressed={mode==='region'}><MapPin size={15}/>省市区选择</button></div>{mode==='search'?<><div className="search-input-wrap"><Search size={20}/><Input autoFocus role="combobox" aria-expanded={results.length>0} aria-controls="city-search-results" aria-autocomplete="list" aria-activedescendant={active>=0?`search-result-${active}`:undefined} placeholder="城市、区县或英文名称" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(a+1,results.length-1));}if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0));}if(e.key==='Enter'&&results[active])onChoose(results[active]);}} aria-label="搜索城市或区县"/>{query&&<button className="icon-button small" aria-label="清空搜索" onClick={()=>setQuery('')}><X size={16}/></button>}</div><div className="search-results" id="city-search-results" role="listbox" aria-label="城市建议">{results.map((l,i)=><button key={l.id} id={`search-result-${i}`} className={`search-result ${active===i?'active':''}`} role="option" aria-selected={active===i} onClick={()=>onChoose(l)} onMouseEnter={()=>setActive(i)}><span className="result-pin"><MapPin size={18}/></span><span><b>{l.name}</b><small>{locationLabel(l)}</small></span><ChevronRight size={17}/></button>)}</div>{busy&&<div className="inline-loading" role="status"><RefreshCw size={16} className="spin"/>正在寻找地点…</div>}{!busy&&query&&!results.length&&!error&&<Empty message="未找到匹配地点，试试完整名称或英文名称。"/>}{!query&&<><button className="search-location" onClick={()=>void locate()} disabled={locating}><Navigation size={18}/>{locating?'正在定位…':'使用当前位置'}<ChevronRight size={16}/></button><div className="popular-searches"><span>常用搜索</span>{['北京','上海','杭州','长安','London','Tokyo'].map(name=><button key={name} onClick={()=>setQuery(name)}>{name}</button>)}</div></>}</>:<div className="region-selector">{catalogError?<Empty message={catalogError} onRetry={()=>setReload(v=>v+1)}/>:!catalog.length?<Empty loading/>:<><label>省份 / 直辖市 / 特别行政区<WeatherSelect label="省份 / 直辖市 / 特别行政区" disabled={busy} value={province} onChange={value=>{setProvince(value);setCity('');setDistrict('');}} placeholder="请选择省级地区" options={provinces.map(n=>({value:n,label:n}))}/></label><label>城市 / 上级行政区<WeatherSelect label="城市 / 上级行政区" value={city} disabled={!province||busy} onChange={value=>{setCity(value);setDistrict('');}} placeholder="请选择城市" options={cityNames.map(n=>({value:n,label:n}))}/></label><label>区县 / 地点<WeatherSelect label="区县 / 地点" value={district} disabled={!city||busy} onChange={setDistrict} placeholder="请选择区县或地点" options={districts.map(l=>({value:l.id,label:l.name}))}/></label><button className="primary-button full-width" disabled={!district||busy} onClick={()=>void confirmRegion()}>{busy?<RefreshCw size={16} className="spin"/>:<MapPin size={16}/>}查看天气</button><p className="small-note">找不到地点时可切换至搜索。</p></>}</div>}{error&&<div className="search-error" role="status"><CircleAlert size={17}/>{error}</div>}{configured===false&&<p className="search-config-note"><Info size={14}/>天气服务尚未连接，在线搜索与地点确认将在配置后可用。</p>}<div className="search-attribution">位置服务：<a href="https://www.qweather.com" target="_blank" rel="noreferrer">和风天气</a></div></div></Modal>;
}

function AdvancedWeather({place,configured,prefs,current,daily,hourly,revision,onLoadingChange,onBack,onSearch,onDetail}:{revision:number;onLoadingChange:(loading:boolean)=>void;place:Location|null;configured:boolean|null;prefs:Preferences;current:Slot;daily:Slot;hourly:Slot;onBack:()=>void;onSearch:()=>void;onDetail:(data:WeatherPoint)=>void}){
 const [kind,setKind]=useState<'current'|'daily'|'hourly'>('hourly'),[length,setLength]=useState('24'),[requested,setRequested]=useState(24),[display,setDisplay]=useState<'chart'|'list'|'data'>('chart'),[slot,setSlot]=useState<Slot>(emptySlot),[retry,setRetry]=useState(0),[rangeError,setRangeError]=useState('');
 const tz=place?.tz??'Asia/Shanghai';
 const home=retry===0?(kind==='current'?current:kind==='daily'&&requested===10?daily:kind==='hourly'&&requested===24?hourly:undefined):undefined;
 const lastRequest=useRef({revision,retry});
 useEffect(()=>{onLoadingChange(slot.loading);},[slot.loading,onLoadingChange]);
 useEffect(()=>()=>onLoadingChange(false),[onLoadingChange]);
 useEffect(()=>{const controller=new AbortController();
  const force=lastRequest.current.revision!==revision||lastRequest.current.retry!==retry;lastRequest.current={revision,retry};
  if(!place||configured!==true){setSlot(emptySlot);return;}
  if(home){setSlot(home);return;}
  const url=weatherUrl(place,kind,requested);
  void loadWeather(url,()=>request<ApiResult>(url,controller.signal,force),controller.signal,setSlot);
  return()=>controller.abort();
 },[place,configured,kind,requested,home,retry,revision]);
 function switchKind(next:typeof kind){setRetry(0);setKind(next);const n=next==='daily'?10:24;setRequested(n);setLength(String(n));setRangeError('');}
 const data=slot.result?.data,rows=kind==='daily'?data?.days??[]:data?.hours??[];
 // 仅在成功返回部分预报时提示缺口，加载、错误和空数据由各自状态说明。
 return <div className="advanced-page"><button className="text-button back-button" onClick={onBack}><ChevronLeft size={16}/>天气概览</button><div className="advanced-heading"><h1>详细天气</h1>{place&&<p>{locationLabel(place)}</p>}</div><section className="glass advanced-card"><div className="advanced-controls"><div className="segmented">{(['current','daily','hourly'] as const).map(k=><button key={k} className={kind===k?'active':''} onClick={()=>switchKind(k)} aria-pressed={kind===k}>{k==='current'?'实时天气':k==='daily'?'每日预报':'逐小时预报'}</button>)}</div>{kind!=='current'&&<form className="range-form" onSubmit={e=>{e.preventDefault();const n=Number(length);if(!Number.isInteger(n)||n<1||n>(kind==='daily'?10:240)){setRangeError(`请输入 1–${kind==='daily'?10:240} 的整数`);return;}setRangeError('');setRequested(n);}}><label htmlFor="forecast-length">未来</label><Input id="forecast-length" type="number" min="1" max={kind==='daily'?10:240} step="1" value={length} onChange={e=>setLength(e.target.value)}/><span>{kind==='daily'?'天':'小时'}</span><button className="small-primary" type="submit">查看</button></form>}</div>{rangeError&&<p role="status" className="search-error">{rangeError}</p>}<div className="advanced-toolbar">{kind!=='current'&&<div className="view-tabs" aria-label="数据视图">{(['chart','list','data'] as const).map(v=><button className={v===display?'active':''} key={v} onClick={()=>setDisplay(v)} aria-pressed={v===display}>{v==='chart'?'趋势图':v==='list'?'列表':'数据详情'}</button>)}</div>}<Freshness result={slot.result} tz={tz}/></div>{!place?<div className="advanced-empty"><Empty message="选择城市，查看完整天气数据"/><button className="primary-button" onClick={onSearch}><Search size={16}/>选择城市</button></div>:configured===false?<Empty message="天气服务未连接，配置完成后即可查询。"/>:slot.loading&&!data?<Empty loading/>:slot.error&&!data?<Empty message={slot.error} onRetry={()=>setRetry(v=>v+1)}/>:!data?<Empty/>:kind==='current'?<DataFields data={data} prefs={prefs} tz={tz}/>:rows.length===0?<Empty message="此预报范围暂时没有数据"/>:display==='chart'?kind==='hourly'?<ForecastTrends hours={rows} prefs={prefs} tz={tz}/>:<><section className="detail-trend-section"><h3>气温趋势</h3><DailyChart days={rows} prefs={prefs} tz={tz}/></section><section className="detail-trend-section"><h3>降水概率</h3><DailyRainChart days={rows} tz={tz}/></section></>:display==='list'?kind==='daily'?<Daily data={rows} prefs={prefs} tz={tz} onDetails={onDetail}/>:<div className="hour-table-wrap"><table className="hour-table"><thead><tr><th>当地时间</th><th>温度</th><th>体感</th><th>降水概率</th><th>天气</th><th>详情</th></tr></thead><tbody>{rows.map((h,i)=><tr key={h.forecastTime??i}><td>{localDate(h.forecastTime,tz).slice(5)} {localTime(h.forecastTime,tz)}</td><td>{tempText(h.temperature,prefs)}</td><td>{tempText(h.feelsLike,prefs)}</td><td>{percent(h.precipitation?.probability)}</td><td><span className="table-condition"><WeatherIcon code={h.condition?.code} night={isNight(daily.result?.data.days?.find(d=>localDate(d.forecastStartTime,tz)===localDate(h.forecastTime,tz)),h.forecastTime??'')===true} size={22}/>{h.condition?.text??'—'}</span></td><td><button className="icon-button small" aria-label={`查看${localTime(h.forecastTime,tz)}详情`} onClick={()=>onDetail(h)}><ChevronRight size={16}/></button></td></tr>)}</tbody></table></div>:<div className="forecast-details-list">{rows.map((h,i)=><details key={h.forecastTime??h.forecastStartTime??i}><summary>{kind==='daily'?`${dayLabel(h.forecastStartTime,tz)} · ${localDate(h.forecastStartTime,tz)}`:`${localDate(h.forecastTime,tz)} ${localTime(h.forecastTime,tz)}`}<span>{kind==='daily'?h.daytime?.condition?.text:h.condition?.text}</span></summary><DataFields data={h} prefs={prefs} tz={tz}/></details>)}</div>}{!slot.loading&&!slot.error&&kind!=='current'&&rows.length>0&&rows.length<requested&&<p className="small-note actual-count">仅有 {rows.length} {kind==='daily'?'天':'小时'}预报，其余时段暂无数据。</p>}{data&&<Attribution results={[slot.result]}/>}</section></div>;
}

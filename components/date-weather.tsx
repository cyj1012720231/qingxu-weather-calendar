'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import { type ApiResult, type Location, type Preferences, localDate, tempText } from '../lib/weather';
import { weatherDateKind, forecastForDate, hoursForDate, weatherDates, pastHoursNote } from '../lib/date-weather';
import { createDateSwipe } from '../lib/gestures';
import { lookup, request, weatherUrl, loadWeather, type WeatherSlot } from '../lib/weather-client';
import { Attribution, DataFields, Empty, ForecastTrends, Freshness, Modal, WeatherIcon } from './weather-ui';

/** 日历与预报共用日期详情；同一城市的预报只加载一次，翻日只筛选本地数据。 */
export function DateWeather({date,place,prefs,configured,now,revision,initialDaily,onLoadingChange,onDateChange,onClose,onSearch,onConnection}:{date:string;place:Location|null;prefs:Preferences;configured:boolean|null;now:string;revision:number;initialDaily?:WeatherSlot;onLoadingChange:(loading:boolean)=>void;onDateChange:(date:string)=>void;onClose:()=>void;onSearch:()=>void;onConnection:()=>void}){
 const tz=place?.tz??'Asia/Shanghai',kind=weatherDateKind(date,tz,now||new Date().toISOString());
 const eligible=!!place&&configured===true&&(kind==='history'||kind==='forecast');
 const historicalDate=kind==='history'?date:undefined;
 const queryKey=place?(kind==='history'?`${place.id}:${date}:history`:weatherUrl(place,'daily')):'';
 const hourlyKey=place?weatherUrl(place,'hourly',240):'';
 const [slot,setSlot]=useState<WeatherSlot>(()=>initialDaily?.key===queryKey?initialDaily:{loading:false});
 const [hourly,setHourly]=useState<WeatherSlot>({loading:false}),[retry,setRetry]=useState(0);
 const [dates]=useState(()=>weatherDates(date,tz,now||new Date().toISOString()));
 const seed=useRef(initialDaily),lastRequest=useRef({revision,retry}),lastHourly=useRef({revision,retry});
 const selectedButton=useRef<HTMLButtonElement>(null),body=useRef<HTMLDivElement>(null),swipe=useRef(createDateSwipe());
 const result=eligible&&slot.key===queryKey?slot.result:undefined;
 const hourlyResult=eligible&&kind==='forecast'&&hourly.key===hourlyKey?hourly.result:undefined;
 const day=result?(kind==='history'?result.data:forecastForDate(result.data.days??[],date,tz)):undefined;
 const forecast=hourlyResult?.data;
 const pastHours=hoursForDate(forecast?.pastHours??[],date,tz);
 const hours=hoursForDate(kind==='history'?day?.hours??[]:[...pastHours,...forecast?.hours??[]],date,tz);
 const pastNote=kind==='forecast'&&hourlyResult?pastHoursNote(hours,pastHours.length>0,date,tz,now):undefined;
 const loading=eligible&&(slot.key!==queryKey||slot.loading),hourlyLoading=eligible&&kind==='forecast'&&(hourly.key!==hourlyKey||hourly.loading);
 useEffect(()=>{onLoadingChange(loading||hourlyLoading);},[loading,hourlyLoading,onLoadingChange]);
 useEffect(()=>()=>onLoadingChange(false),[onLoadingChange]);
 useEffect(()=>{selectedButton.current?.scrollIntoView({block:'nearest',inline:'center'});body.current?.scrollTo({top:0});},[date]);
 useEffect(()=>{
  const force=lastRequest.current.revision!==revision||lastRequest.current.retry!==retry;lastRequest.current={revision,retry};
  if(!place||!eligible)return;
  const controller=new AbortController(),saved=seed.current;seed.current=undefined;
  void loadWeather(queryKey,async()=>{
   if(!force&&saved?.key===queryKey&&saved.result)return saved.result;
   let url=queryKey;
   if(kind==='history'){
    // 定位城市的界面 ID 含 gps 前缀；历史接口只接受 GeoAPI 的真实 LocationID。
    const location=place.id.startsWith('gps:')?(await lookup(`${place.lon.toFixed(2)},${place.lat.toFixed(2)}`,controller.signal))[0]:place;
    if(!location)throw Error('当前坐标暂不支持历史天气，请搜索附近城市。');
    url='/api/weather?'+new URLSearchParams({kind:'history',location:location.id,date:historicalDate!,tz});
   }
   const data=await request<ApiResult>(url,controller.signal,force);
   if(kind==='history'&&data.data.date!==historicalDate)throw Error('历史天气返回日期不符，请稍后重试。');
   return data;
  },controller.signal,setSlot);
  return()=>controller.abort();
 },[queryKey,place,eligible,kind,historicalDate,tz,retry,revision]);
 useEffect(()=>{
  const force=lastHourly.current.revision!==revision||lastHourly.current.retry!==retry;lastHourly.current={revision,retry};
  if(!eligible||kind!=='forecast')return;
  const controller=new AbortController();
  void loadWeather(hourlyKey,()=>request<ApiResult>(hourlyKey,controller.signal,force),controller.signal,setHourly);
  return()=>controller.abort();
 },[hourlyKey,eligible,kind,retry,revision]);
 const index=dates.indexOf(date),today=localDate(now,tz);
 const dateLabel=kind==='invalid'?'日期无效':new Intl.DateTimeFormat('zh-CN',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(`${date}T12:00:00Z`));
 const change=(next:string|undefined)=>{if(next&&next!==date)onDateChange(next);};
 const retryLoad=()=>setRetry(value=>value+1);
 const message=!place?'先选择城市，再查询这一天的天气。':kind==='past'?'该日期超出历史查询范围。当前支持过去 10 天的历史天气。':kind==='future'?'这一天的预报还未发布。当前支持含今天在内的 10 日预报。':kind==='invalid'?'日期无效，请返回日历重新选择。':configured!==true?'天气服务尚未就绪。连接后即可查询所选日期。':slot.error??'天气服务暂未返回这一天的数据，请稍后重试。';
 return <Modal title="天气状况" subtitle={place?.name??'选择城市'} onClose={onClose} wide className="date-weather-modal">
 <div className="date-weather-surface" onPointerDown={event=>{
  // 图表、按钮与日期条保留原有操作，只有空白区域接管横滑。
  if(!event.isPrimary||event.button!==0||(event.target as Element).closest('button,a,input,select,summary,svg,.weather-date-strip'))return;
  swipe.current.start(event.clientX,event.clientY);event.currentTarget.setPointerCapture(event.pointerId);
 }} onPointerMove={event=>swipe.current.move(event.clientX,event.clientY)} onPointerUp={()=>{const direction=swipe.current.release();if(direction)change(dates[index+direction]);}} onPointerCancel={()=>swipe.current.cancel()}>
 <header className="weather-date-header">
  <nav className="weather-date-navigation" aria-label="天气日期"><button className="icon-button" aria-label="前一天" disabled={index<=0} onClick={()=>change(dates[index-1])}><ChevronLeft size={19}/></button><div className="weather-date-strip">{dates.map(item=><button key={item} ref={item===date?node=>{selectedButton.current=node;if(node)requestAnimationFrame(()=>node.scrollIntoView({block:'nearest',inline:'center'}));}:undefined} className={`weather-date-option ${item===date?'active':''} ${item===today?'is-today':''}`} aria-pressed={item===date} aria-label={`${item} 的天气`} onClick={()=>change(item)} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();change(dates[dates.indexOf(item)+(event.key==='ArrowRight'?1:-1)]);requestAnimationFrame(()=>selectedButton.current?.focus());}}}><span>{new Intl.DateTimeFormat('zh-CN',{timeZone:'UTC',weekday:'short'}).format(new Date(`${item}T12:00:00Z`)).replace('周','')}</span><strong>{Number(item.slice(-2))}</strong></button>)}</div><button className="icon-button" aria-label="后一天" disabled={index<0||index>=dates.length-1} onClick={()=>change(dates[index+1])}><ChevronRight size={19}/></button></nav>
  <div className="weather-selected-date"><time dateTime={date}>{dateLabel}</time><button className="icon-button small" aria-label="刷新这一天的天气" disabled={!eligible||loading||hourlyLoading} onClick={retryLoad}><RefreshCw size={16} className={loading||hourlyLoading?'refresh-spinning':''}/></button></div>
  {day&&<div className="date-weather-summary"><p className="date-weather-temperatures"><strong aria-label={`最高 ${tempText(day.temperatureMax,prefs)}`}>{tempText(day.temperatureMax,prefs)}</strong><span aria-label={`最低 ${tempText(day.temperatureMin,prefs)}`}>{tempText(day.temperatureMin,prefs)}</span><small>°{prefs.temperature}</small></p><span className="date-weather-condition"><WeatherIcon code={day.daytime?.condition?.code??hours[0]?.condition?.code} size={26}/>{day.daytime?.condition?.text??(kind==='history'?'历史天气':'')}</span></div>}
 </header>
 <div ref={body} className="date-weather-body">
 {eligible?<><ForecastTrends hours={hours} prefs={prefs} tz={tz} date={date} day={day} pastNote={pastNote} loading={kind==='history'?loading:hourlyLoading} error={kind==='history'?slot.error:hourly.error} onRetry={retryLoad}/>{day?<DataFields data={{...day,temperatureMax:undefined,temperatureMin:undefined}} prefs={prefs} tz={tz} date={date}/>:<Empty loading={loading} message={message} onRetry={retryLoad}/>}<Freshness result={result} tz={tz}/><Freshness result={hourlyResult} tz={tz}/><Attribution results={[result,hourlyResult]}/></>:<><Empty message={message}/>{!place&&<button className="primary-button date-weather-action" onClick={onSearch}><MapPin size={17}/>选择城市</button>}{place&&configured!==true&&<button className="primary-button date-weather-action" onClick={onConnection}>检查天气连接</button>}</>}
 </div></div></Modal>;
}

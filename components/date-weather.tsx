'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { type ApiResult, type Location, type Preferences, type WeatherPoint, tempText } from '../lib/weather';
import { weatherDateKind, forecastForDate } from '../lib/date-weather';
import { lookup, request, weatherUrl } from '../lib/weather-client';
import { Attribution, DataFields, Empty, Freshness, WeatherIcon } from './weather-ui';

/** 请求绑定城市和日期，卸载或切换时取消，避免旧响应覆盖新选择。 */
export function DateWeather({date,place,prefs,configured,now,revision,onBack,onSearch,onConnection}:{date:string;place:Location|null;prefs:Preferences;configured:boolean|null;now:string;revision:number;onBack:()=>void;onSearch:()=>void;onConnection:()=>void}){
 const [slot,setSlot]=useState<{result?:ApiResult;day?:WeatherPoint;loading:boolean;error?:string}>({loading:false}),[retry,setRetry]=useState(0);
 const tz=place?.tz??'Asia/Shanghai',kind=weatherDateKind(date,tz,now||new Date().toISOString());
 useEffect(()=>{setSlot({loading:false});if(!place||configured!==true||!['history','forecast'].includes(kind))return;
  const controller=new AbortController();setSlot({loading:true});
  void(async()=>{try{
   let url=weatherUrl(place,'daily');
   if(kind==='history'){
    // 定位城市的界面 ID 含 gps 前缀；历史接口只接受 GeoAPI 的真实 LocationID。
    const location=place.id.startsWith('gps:')?(await lookup(`${place.lon.toFixed(2)},${place.lat.toFixed(2)}`,controller.signal))[0]:place;
    if(!location)throw Error('当前坐标暂不支持历史天气，请搜索附近城市。');
    url='/api/weather?'+new URLSearchParams({kind:'history',location:location.id,date,tz});
   }
   const result=await request<ApiResult>(url,controller.signal);
   const day=kind==='history'?result.data:forecastForDate(result.data.days??[],date,tz);
   if(kind==='history'&&day?.date!==date)throw Error('历史天气返回日期不符，请稍后重试。');
   if(!controller.signal.aborted)setSlot({loading:false,result,day});
  }catch(e){if(!controller.signal.aborted)setSlot({loading:false,error:e instanceof Error?e.message:'天气查询失败，请重试。'});}})();
  return()=>controller.abort();
 },[date,place,configured,kind,tz,retry,revision]);
 const message=!place?'先选择城市，再查询这一天的天气。':kind==='past'?'该日期超出历史查询范围。当前支持过去 10 天的历史天气。':kind==='future'?'这一天的预报还未发布。当前支持含今天在内的 10 日预报。':kind==='invalid'?'日期无效，请返回日历重新选择。':configured!==true?'天气服务尚未就绪。连接后即可查询所选日期。':slot.error??'天气服务暂未返回这一天的数据，请稍后重试。';
 return <section className="date-weather-view"><button className="text-button back-to-calendar" onClick={onBack}><ArrowLeft size={16}/>返回日历 · 保留所选日期</button><div className="date-weather-heading"><span className="hero-eyebrow">{kind==='history'?'历史天气 · 再分析数据':'当天天气'}</span><h1>{date.replaceAll('-',' / ')}</h1><button className="text-button" onClick={onSearch}><MapPin size={16}/>{place?.name??'选择城市'} · 更换</button><p className="small-note">{place?`按 ${place.name} 当地日期查询 · ${tz}`:'日历选择的公历日期将在所选城市查询'}</p></div>
 {slot.day?<><section className="glass date-weather-summary"><WeatherIcon code={slot.day.daytime?.condition?.code} size={54}/><div><p>{slot.day.daytime?.condition?.text??(kind==='history'?'当天历史记录':'当日预报')}</p><h2>{tempText(slot.day.temperatureMin,prefs)} <span>—</span> {tempText(slot.day.temperatureMax,prefs)}</h2><span className="small-note">最低 / 最高温度 · °{prefs.temperature}</span></div></section><section className="glass date-weather-fields"><DataFields data={slot.day} prefs={prefs} tz={tz}/><Freshness result={slot.result} tz={tz}/><Attribution results={[slot.result]}/></section></>:<section className="glass"><Empty loading={slot.loading} message={message} onRetry={place&&configured===true&&['history','forecast'].includes(kind)?()=>setRetry(v=>v+1):undefined}/>{!place&&<button className="primary-button date-weather-action" onClick={onSearch}>选择城市</button>}{place&&configured!==true&&<button className="primary-button date-weather-action" onClick={onConnection}>检查天气连接</button>}</section>}
 </section>;
}

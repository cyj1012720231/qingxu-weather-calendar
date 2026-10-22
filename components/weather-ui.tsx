'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudRain, CloudLightning, CloudSnow, CloudFog, CircleHelp, X, ChevronRight, Droplets, Wind, Eye, Gauge, Sunrise, Sunset, Thermometer, CalendarDays, Clock, CloudOff, RefreshCw, ArrowUpRight } from 'lucide-react';
import { type WeatherPoint, type Preferences, type ApiResult, temperature, speed, tempText, windText, measureText, visibilityText, percent, finite, numberText, localTime, localDate, dayLabel, weatherKind, isNight, temperatureRange, compassNames, moonNames, fieldNames } from '../lib/weather';
import { weatherHourTime } from '../lib/date-weather';

export function WeatherIcon({code,night=false,size=30}:{code?:string;night?:boolean;size?:number}){
 const kind=weatherKind(code);const Icon=kind==='clear'?(night?Moon:Sun):kind==='cloudy'?(night?CloudMoon:CloudSun):kind==='overcast'?Cloud:kind==='rain'?CloudRain:kind==='storm'?CloudLightning:kind==='snow'?CloudSnow:kind==='fog'?CloudFog:CircleHelp;
 return <Icon size={size} strokeWidth={1.7} className={`weather-icon icon-${kind}`} aria-hidden="true"/>;
}
export function SkyArt(){return <svg viewBox="0 0 300 190" className="sky-art" aria-hidden="true"><defs><radialGradient id="sun-fill"><stop stopColor="#fff6c3"/><stop offset="1" stopColor="#ffd478"/></radialGradient><linearGradient id="cloud-fill" x2=".2" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#b8d4ed"/></linearGradient><filter id="art-glow"><feGaussianBlur stdDeviation="14"/></filter><filter id="cloud-shadow" x="-30%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#1b416f" floodOpacity=".2"/></filter></defs><circle cx="181" cy="64" r="50" fill="#ffe5a1" opacity=".2" filter="url(#art-glow)"/><circle cx="181" cy="64" r="35" fill="url(#sun-fill)"/><path d="M73 149C34 149 29 100 67 94C72 61 119 54 138 80C169 66 201 89 197 115C229 113 238 149 207 155H74Z" fill="url(#cloud-fill)" filter="url(#cloud-shadow)"/><path d="M209 155H252C274 155 271 128 251 129C247 109 219 108 212 127C190 120 185 150 209 155Z" fill="#e2effa" opacity=".8"/></svg>;}
export function Modal({title,subtitle,onClose,children,wide=false,className=''}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode;wide?:boolean;className?:string}){
 // 使用同一组件库的弹层，避免原生 dialog 顶层遮挡下拉菜单的 Portal。
 // 在子输入框自动聚焦前记住入口，关闭后可继续用键盘操作原页面。
 const previous=useRef<HTMLElement|null>(typeof document==='undefined'?null:document.activeElement as HTMLElement);
 // Radix 等退出动画结束后再卸载；父层切换弹窗时不回调关闭，避免清空新弹窗。
 const descriptionId=useId(),[open,setOpen]=useState(true);
 return <Dialog open={open} onOpenChange={setOpen}><DialogContent className={`modal ${wide?'modal-wide':''} ${className}`} showCloseButton={false} aria-describedby={subtitle?descriptionId:undefined} onEscapeKeyDown={event=>{event.preventDefault();onClose();}} onCloseAutoFocus={event=>{event.preventDefault();previous.current?.focus();if(!open)onClose();}}><div className="modal-header"><div><DialogTitle asChild><h2>{title}</h2></DialogTitle>{subtitle&&<DialogDescription id={descriptionId} asChild><p>{subtitle}</p></DialogDescription>}</div><button className="icon-button" onClick={event=>event.detail===0?onClose():setOpen(false)} aria-label="关闭"><X size={22}/></button></div>{children}</DialogContent></Dialog>;
}
export function Empty({loading=false,message='暂无天气数据',onRetry}:{loading?:boolean;message?:string;onRetry?:()=>void}){
 return <div className={`empty-state ${loading?'is-loading':''}`} role="status">{loading?<><div className="skeleton skeleton-wide"/><div className="skeleton"/><span>加载中…</span></>:<><CloudOff size={27} strokeWidth={1.3}/><p>{message}</p>{onRetry&&<button className="text-button" onClick={onRetry}><RefreshCw size={15}/>重新加载</button>}</>}</div>;
}
export function Attribution({results}:{results:(ApiResult|undefined)[]}){
 const attributions=[...new Set(results.flatMap(r=>r?.data.metadata?.attributions??[]))];
 return <div className="attribution"><span>天气数据：<a href="https://www.qweather.com" target="_blank" rel="noreferrer">和风天气</a></span>{attributions.map(a=><span key={a}>{/^https:\/\//.test(a)?<a href={a} target="_blank" rel="noreferrer">来源说明</a>:a}</span>)}</div>;
}
// 正常数据省去获取时间；过期回退仍提示来源时间和原因，避免被当作最新天气。
export function Freshness({result,tz}:{result?:ApiResult;tz:string}){return result?.stale?<span className="stale-tag">缓存 · 非最新 {localDate(result.fetchedAt,tz)} {localTime(result.fetchedAt,tz)}{result.warning?` · ${result.warning}`:''}</span>:null;}
export function Hourly({data,prefs,tz,days,onDetails}:{data:WeatherPoint[];prefs:Preferences;tz:string;days:WeatherPoint[];onDetails:(h:WeatherPoint)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 return <div className="hourly-scroll" ref={ref} onWheel={e=>{const el=ref.current;if(el&&Math.abs(e.deltaY)>Math.abs(e.deltaX)&&el.scrollWidth>el.clientWidth){el.scrollLeft+=e.deltaY;}}}>{data.map((h,i)=>{const day=days.find(d=>localDate(d.forecastStartTime,tz)===localDate(h.forecastTime,tz));return <button className="hour-item" key={h.forecastTime??i} onClick={()=>onDetails(h)} aria-label={`${localTime(h.forecastTime,tz)} ${h.condition?.text??''} ${tempText(h.temperature,prefs)}，查看详情`}><span className="hour-time">{localTime(h.forecastTime,tz)}</span><WeatherIcon code={h.condition?.code} night={isNight(day,h.forecastTime??'')===true}/><strong>{tempText(h.temperature,prefs)}</strong><span className="rain-chance">{h.precipitation?.probability!==undefined?percent(h.precipitation.probability):'—'}</span></button>;})}</div>;
}
export function Daily({data,prefs,tz,onDetails}:{data:WeatherPoint[];prefs:Preferences;tz:string;onDetails:(day:WeatherPoint)=>void}){
 const values=data.flatMap(d=>[temperature(d.temperatureMin,prefs.temperature),temperature(d.temperatureMax,prefs.temperature)]).filter(finite);
 const min=Math.min(...values),max=Math.max(...values);
 return <div className="daily-list">{data.map((d,i)=>{const range=temperatureRange(temperature(d.temperatureMin,prefs.temperature),temperature(d.temperatureMax,prefs.temperature),min,max);const chances=[d.daytime?.precipitation?.probability,d.nighttime?.precipitation?.probability].filter(finite);return <button className="day-row" title={`白天降水概率 ${percent(d.daytime?.precipitation?.probability)}；夜间 ${percent(d.nighttime?.precipitation?.probability)}；列表显示较高时段概率`} onClick={()=>onDetails(d)} key={d.forecastStartTime??i}><span className="day-name">{dayLabel(d.forecastStartTime,tz)}<small>{localDate(d.forecastStartTime,tz).slice(5).replace('-','/')}</small></span><span className="day-weather"><WeatherIcon code={d.daytime?.condition?.code} size={26}/><small>{chances.length?percent(Math.max(...chances)):'—'}</small></span><span className="low-temp">{tempText(d.temperatureMin,prefs)}</span><span className="temp-track">{range&&<span style={{left:`${range.left}%`,width:`${Math.max(range.width,1)}%`}}/>}</span><span>{tempText(d.temperatureMax,prefs)}</span><ChevronRight size={14}/></button>;})}</div>;
}
type FieldGroup={title:string;icon:typeof Sun;keys:string[]};
const dateFieldKeys=['date','forecastTime','forecastStartTime','forecastEndTime'];
const weatherFieldGroups:FieldGroup[]=[
 {title:'日期与时段',icon:Clock,keys:dateFieldKeys},
 {title:'天气与温度',icon:Thermometer,keys:['temperature','feelsLike','temperatureMax','temperatureMin','temperatureAvg','condition']},
 {title:'降水',icon:CloudRain,keys:['precipitation']},
 {title:'风',icon:Wind,keys:['wind','windGust','windGustMax']},
 {title:'紫外线',icon:Sun,keys:['uvIndex','uvIndexMax']},
 {title:'湿度与能见度',icon:Droplets,keys:['humidity','dewPoint','visibility','cloudCover']},
 {title:'气压',icon:Gauge,keys:['pressure','stationPressure']},
];
const astroFieldGroups:FieldGroup[]=[
 {title:'日出与日落',icon:Sunrise,keys:['sunrise','sunset','solarNoon','solarMidnight']},
 {title:'月亮信息',icon:Moon,keys:['moonrise','moonset','moonTransit','moonUnderfoot','moonPhase']},
 {title:'晨光',icon:Sunrise,keys:['astronomicalDawn','nauticalDawn','civilDawn']},
 {title:'暮光',icon:Sunset,keys:['astronomicalDusk','nauticalDusk','civilDusk']},
];
/** 按用户阅读习惯分块；未知气象字段仍保留，接口元信息继续交由 Attribution 展示。 */
export function DataFields({data,prefs,tz,date}:{data:unknown;prefs:Preferences;tz:string;date?:string}){
 function valueText(value:unknown,key:string):ReactNode{
  if(value===null||value===undefined)return '—';
  if(typeof value==='object'){const m=value as {value:number;unit:string};if(['°C','°F','K'].includes(m.unit))return `${tempText(m,prefs)}${prefs.temperature}`;if(['m/s','km/h','mph','kn'].includes(m.unit))return windText(m,prefs);return measureText(m);}
  if(['humidity','cloudCover','probability'].includes(key))return percent(value);
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)){
   const localDay=localDate(value,tz),time=localTime(value,tz);
   let label:string|undefined=localDay;
   // 单日页由吸顶栏提供日期；跨日仅显示相对提示，无障碍名称保留完整时间。
   if(date){const offset=(Date.parse(localDay)-Date.parse(date))/86400000;label=!finite(offset)||offset===0?undefined:offset===1?'次日':offset===-1?'前日':`${Math.abs(offset)}天${offset>0?'后':'前'}`;}
   return <time className="weather-data-time" dateTime={value} aria-label={date?`${localDay} ${time}`:undefined}>{label&&<span>{label}</span>}<strong>{time}</strong></time>;
  }
  if(key==='compass')return compassNames[String(value)]??String(value);
  if(key==='moonPhase')return moonNames[String(value)]??String(value);
  if(key==='type')return ({rain:'雨',snow:'雪',ice:'冰粒或冻雨',mixed:'混合降水',none:'无降水',unknown:'未知'} as Record<string,string>)[String(value)]??String(value);
  if(typeof value==='boolean')return value?'是':'否';return String(value);
 }
 /** 风向、降水等嵌套数据展开成同组指标；带单位的测量值保持完整转换。 */
 function fields(value:unknown,key:string,path=key,prefix=''):ReactNode{
  if(Array.isArray(value))return value.length?value.map((v,i)=>fields(v,key,`${path}.${i}`,`${prefix}${i+1} · `)):fields(null,key,path,prefix);
  if(value&&typeof value==='object'&&!('value' in value&&'unit' in value)){
   const entries=Object.entries(value).filter(([k,v])=>k!=='metadata'&&v!==undefined).sort(([a],[b])=>Number(b==='probability')-Number(a==='probability'));
   return entries.length?entries.map(([k,v])=>fields(v,k,`${path}.${k}`,fieldNames[key]?prefix:`${prefix}${key} · `)):fields(null,key,path,prefix);
  }
  return <div className="weather-data-item" key={path}><dt>{prefix}{fieldNames[key]??`其他指标（${key}）`}</dt><dd>{valueText(value,key)}</dd></div>;
 }
 function card(title:string,Icon:typeof Sun,entries:[string,unknown][],children?:ReactNode){return <section className="glass weather-data-card" aria-label={title} key={title}><h3><Icon size={18} aria-hidden="true"/>{title}</h3>{entries.length>0&&<dl className="weather-data-grid">{entries.map(([key,value])=>fields(value,key))}</dl>}{children}</section>;}
 const pick=(record:Record<string,unknown>,keys:string[]):[string,unknown][]=>keys.filter(key=>record[key]!==undefined&&!(date&&dateFieldKeys.includes(key))).map(key=>[key,record[key]]);
 if(!data||typeof data!=='object')return <Empty/>;
 const record=data as Record<string,unknown>;
 const periods=(['daytime','nighttime'] as const).flatMap(key=>record[key]&&typeof record[key]==='object'?[{key,value:record[key] as Record<string,unknown>}]:[]);
 const known=new Set(['metadata','hours','astro','daytime','nighttime',...weatherFieldGroups.flatMap(group=>group.keys)]);
 const remaining=Object.entries(record).filter(([key,value])=>!known.has(key)&&value!==undefined);
 const astro=record.astro&&typeof record.astro==='object'?record.astro as Record<string,unknown>:null;
 const astroOther=astro?Object.entries(astro).filter(([key,value])=>!astroFieldGroups.some(group=>group.keys.includes(key))&&key!=='metadata'&&value!==undefined):[];
 return <div className="data-fields">
  {/* 昼夜指标归入同类卡片，防止降水和温度被整组天文信息挤到末尾。 */}
  {weatherFieldGroups.map(group=>{const entries=pick(record,group.keys),parts=periods.map(period=>({...period,entries:pick(period.value,group.keys)})).filter(part=>part.entries.length);return entries.length||parts.length?card(group.title,group.icon,entries,parts.map(part=><section className="weather-data-period" key={part.key} aria-label={fieldNames[part.key]}><h4>{fieldNames[part.key]}</h4><dl className="weather-data-grid">{part.entries.map(([key,value])=>fields(value,key,`${part.key}.${key}`))}</dl></section>)):null;})}
  {astro?astroFieldGroups.map(group=>{const entries=pick(astro,group.keys);return entries.length?card(group.title,group.icon,entries):null;}):record.astro!==undefined?card('天文',Sun,[['astro',record.astro]]):null}
  {astroOther.length>0&&card('其他天文信息',CircleHelp,astroOther)}
  {periods.map(period=>period.value.astro!==undefined?<section className="weather-data-period" aria-label={`${fieldNames[period.key]}天文`} key={`${period.key}-astro`}><h4>{fieldNames[period.key]} · 天文</h4><DataFields data={{astro:period.value.astro}} prefs={prefs} tz={tz} date={date}/></section>:null)}
  {remaining.length>0&&card('其他气象信息',CircleHelp,remaining)}
  {periods.map(period=>{const entries=Object.entries(period.value).filter(([key,value])=>!known.has(key)&&value!==undefined);return entries.length?card(`${fieldNames[period.key]} · 其他信息`,CircleHelp,entries):null;})}
  {(['daytime','nighttime'] as const).map(key=>record[key]!==undefined&&(!record[key]||typeof record[key]!=='object')?card(fieldNames[key],key==='daytime'?Sun:Moon,[[key,record[key]]]):null)}
 </div>;
}
export function WeatherChart({hours,prefs,tz}:{hours:WeatherPoint[];prefs:Preferences;tz:string}){
 const [metric,setMetric]=useState<'temperature'|'rain'|'wind'>('temperature');const [selected,setSelected]=useState<number|null>(null);const id=useId().replace(/:/g,'');
 const values=hours.map(h=>metric==='temperature'?temperature(h.temperature,prefs.temperature):metric==='rain'?(finite(h.precipitation?.probability)?h.precipitation!.probability!*100:null):speed(h.wind?.speed,prefs.wind));
 const available=values.filter(finite),min=metric==='rain'?0:Math.floor(Math.min(...available)-1),max=metric==='rain'?100:Math.ceil(Math.max(...available)+1);const width=Math.max(680,hours.length*19),height=175,pad=28;
 const point=(i:number,v:number)=>({x:pad+i/(Math.max(hours.length-1,1))*(width-pad*2),y:height-25-(v-min)/(max-min||1)*(height-48)});
 let line='';values.forEach((v,i)=>{if(v===null)return;const p=point(i,v);line+=`${i===0||values[i-1]===null?'M':'L'}${p.x},${p.y} `;});
 const suffix=metric==='temperature'?`°${prefs.temperature}`:metric==='rain'?'%':` ${prefs.wind}`;
 return <><div className="chart-toolbar"><div className="segmented" aria-label="趋势指标">{(['temperature','rain','wind'] as const).map(k=><button key={k} aria-pressed={metric===k} className={metric===k?'active':''} onClick={()=>{setMetric(k);setSelected(null);}}>{k==='temperature'?'温度':k==='rain'?'降水概率':'风速'}</button>)}</div><span className="chart-selected" aria-live="polite">{selected!==null&&hours[selected]?`${localDate(hours[selected].forecastTime,tz).slice(5)} ${localTime(hours[selected].forecastTime,tz)} · ${numberText(values[selected],1)}${values[selected]!==null?suffix:''}`:''}</span></div>{available.length?<div className="chart-scroll"><svg viewBox={`0 0 ${width} 205`} style={{minWidth:width}} className="weather-chart" role="group" aria-label={`${metric==='temperature'?'温度':metric==='rain'?'降水概率':'风速'}变化趋势`}><defs><linearGradient id={`chart-${id}`} x2="0" y2="1"><stop stopColor="#c5e4fc" stopOpacity=".25"/><stop offset="1" stopColor="#c5e4fc" stopOpacity="0"/></linearGradient></defs>{[0,.5,1].map(r=><g key={r}><line x1={pad} x2={width-pad} y1={25+r*125} y2={25+r*125} className="chart-grid"/><text x={pad} y={20+r*125}>{numberText(max-(max-min)*r)}{suffix}</text></g>)}<path d={line} fill="none" stroke="var(--chart-line)" strokeWidth="2.5" strokeLinejoin="round"/>{values.map((v,i)=>{if(v===null)return null;const p=point(i,v);return <g key={i}><circle cx={p.x} cy={p.y} r={selected===i?5:2.4} fill="var(--chart-line)"/><rect x={p.x-10} y="0" width="20" height="175" fill="transparent" tabIndex={0} role="button" aria-label={`${localDate(hours[i].forecastTime,tz)} ${localTime(hours[i].forecastTime,tz)}，${numberText(v,1)}${suffix}`} onMouseEnter={()=>setSelected(i)} onFocus={()=>setSelected(i)} onPointerDown={()=>setSelected(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelected(i);}}/>{(i%Math.max(1,Math.ceil(hours.length/10))===0||i===hours.length-1)&&<text x={p.x} y="196" textAnchor="middle">{hours.length>48?localDate(hours[i].forecastTime,tz).slice(5):localTime(hours[i].forecastTime,tz)}</text>}</g>;})}{selected!==null&&values[selected]!==null&&values[selected]!==undefined&&<line x1={point(selected,values[selected]!).x} x2={point(selected,values[selected]!).x} y1="22" y2="165" stroke="var(--chart-line)" strokeDasharray="3 4" opacity=".5"/>}</svg></div>:<Empty message="这一指标暂时没有可用数据"/>}</>;
}

/** 单日与多小时详情共用真实时序；空值或缺失小时断线，不插补温度和降水。 */
function HourMetricChart({hours,prefs,tz,date,metric,day}:{hours:WeatherPoint[];prefs:Preferences;tz:string;date?:string;day?:WeatherPoint;metric:'temperature'|'feelsLike'|'rain'|'wind'}){
 const id=useId().replace(/:/g,''),[selected,setSelected]=useState<number|null>(null);
 const rain=metric==='rain',wind=metric==='wind',width=date?400:Math.max(680,hours.length*19),left=10,right=width-45,top=38,bottom=178;
 const values=hours.map(hour=>rain?(finite(hour.precipitation?.probability)&&hour.precipitation!.probability!>=0&&hour.precipitation!.probability!<=1?hour.precipitation!.probability!*100:null):wind?speed(hour.wind?.speed,prefs.wind):temperature(hour[metric],prefs.temperature));
 const available=values.filter(finite),min=rain?0:Math.floor(Math.min(...available)-2),max=rain?100:Math.ceil(Math.max(...available)+2);
 const minutes=hours.map(hour=>{const [h,m]=weatherHourTime(hour,tz).split(':').map(Number);return h*60+m;});
 const x=(i:number)=>left+(date?minutes[i]/1440:i/Math.max(1,hours.length-1))*(right-left),y=(value:number)=>bottom-(value-min)/(max-min)*(bottom-top);
 const segments:number[][]=[];
 values.forEach((value,i)=>{if(value===null||!finite(minutes[i]))return;const gap=i>0&&(date?minutes[i]-minutes[i-1]:(Date.parse(hours[i].forecastTime??'')-Date.parse(hours[i-1].forecastTime??''))/60000);if(i===0||values[i-1]===null||!finite(gap)||gap>90||gap<0)segments.push([]);if(!segments.length)segments.push([]);segments.at(-1)!.push(i);});
 const suffix=rain?'%':wind?` ${prefs.wind}`:`°${prefs.temperature}`,label=rain?'降水概率':wind?'风速':metric==='feelsLike'?'体感温度':'实际气温';
 if(!available.length)return <Empty message={rain?'暂无逐小时降水概率':wind?'暂无逐小时风速':'暂无逐小时温度数据'}/>;
 return <><div className="trend-readout" aria-live="polite">{selected!==null&&finite(values[selected])?`${weatherHourTime(hours[selected],tz)} · ${numberText(values[selected],1)}${suffix}`:rain?`逐小时最高 ${numberText(Math.max(...available))}%`:wind?`${numberText(Math.min(...available),1)} — ${numberText(Math.max(...available),1)} ${prefs.wind}`:`${numberText(Math.min(...available))}° — ${numberText(Math.max(...available))}° · °${prefs.temperature}`}</div><div className={date?'day-chart':'chart-scroll'}><svg viewBox={`0 0 ${width} 210`} style={date?undefined:{minWidth:width}} className="forecast-chart" role="group" aria-label={`${label}变化趋势`}>
 <defs><linearGradient id={`temperature-fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e9d38d" stopOpacity=".38"/><stop offset="1" stopColor="#72d8dd" stopOpacity=".06"/></linearGradient></defs>
 {[0,.25,.5,.75,1].map(r=><g key={r}><line x1={left} x2={right} y1={top+r*(bottom-top)} y2={top+r*(bottom-top)} className="chart-grid"/><text x={right+7} y={top+r*(bottom-top)+4}>{numberText(max-(max-min)*r)}{rain?'%':wind?'':'°'}</text></g>)}
 {(date?[0,6,12,18,24]:[]).map(hour=><g key={hour}><line x1={left+hour/24*(right-left)} x2={left+hour/24*(right-left)} y1={top} y2={bottom} className="chart-grid vertical"/><text x={left+hour/24*(right-left)} y="202" textAnchor={hour===0?'start':hour===24?'end':'middle'}>{hour}时</text></g>)}
 {!rain&&segments.map((indices,index)=>{const line=indices.map((i,j)=>`${j?'L':'M'}${x(i)},${y(values[i]!)}`).join(' ');return <g key={index}><path d={`${line} L${x(indices.at(-1)!)},${bottom} L${x(indices[0])},${bottom} Z`} fill={`url(#temperature-fill-${id})`}/><path d={line} stroke="#f1dc9c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/></g>;})}
 {values.map((value,i)=>{if(value===null||!finite(minutes[i]))return null;const active=selected===i;return <g key={`${hours[i].forecastTime}-${i}`}>
 {rain?<rect x={x(i)-4} y={y(value)} width="8" height={Math.max(2,bottom-y(value))} rx="3" fill="#9ddbea" opacity={active?1:.8}/>:<circle cx={x(i)} cy={y(value)} r={active?4.5:2.5} fill="#f1dc9c"/>}
 {!rain&&!wind&&i%3===0&&hours[i].condition?.code&&<foreignObject x={x(i)-9} y="6" width="18" height="20"><WeatherIcon code={hours[i].condition?.code} night={isNight(day,hours[i].forecastTime??'')===true} size={18}/></foreignObject>}
 {active&&<line x1={x(i)} x2={x(i)} y1={top} y2={bottom} stroke="#d3eafa" strokeDasharray="3 4"/>}
 <rect x={x(i)-7} y={top} width="14" height={bottom-top} fill="transparent" role="button" tabIndex={0} aria-label={`${weatherHourTime(hours[i],tz)} ${label} ${numberText(value,1)}${suffix}`} onPointerDown={()=>setSelected(i)} onMouseEnter={()=>setSelected(i)} onFocus={()=>setSelected(i)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(i);}}}/>
 {!date&&(i%Math.max(1,Math.ceil(hours.length/8))===0||i===hours.length-1)&&<text x={x(i)} y="202" textAnchor="middle">{hours.length>48?localDate(hours[i].forecastTime,tz).slice(5):weatherHourTime(hours[i],tz)}</text>}
 </g>;})}</svg></div></>;
}

export function ForecastTrends({hours,prefs,tz,date,day,pastNote,loading=false,error,onRetry}:{hours:WeatherPoint[];prefs:Preferences;tz:string;date?:string;day?:WeatherPoint;pastNote?:string;loading?:boolean;error?:string;onRetry?:()=>void}){
 const [metric,setMetric]=useState<'temperature'|'feelsLike'>('temperature');
 return <div className="forecast-trends">{pastNote&&<p className="small-note" role="status">{pastNote}</p>}<section className="glass trend-panel" aria-label="气温趋势"><div className="trend-heading"><h3><Thermometer size={19}/>气温趋势</h3><div className="segmented" aria-label="温度类型">{(['temperature','feelsLike'] as const).map(key=><button key={key} aria-pressed={metric===key} className={metric===key?'active':''} onClick={()=>setMetric(key)}>{key==='temperature'?'实际':'体感'}</button>)}</div></div>{loading&&!hours.length?<Empty loading/>:error&&!hours.length?<Empty message={error} onRetry={onRetry}/>:<HourMetricChart key={`${date}:${metric}`} hours={hours} prefs={prefs} tz={tz} date={date} day={day} metric={metric}/>}</section><section className="glass trend-panel" aria-label="降水概率"><h3><CloudRain size={19}/>降水概率</h3>{day&&(day.daytime?.precipitation?.probability!==undefined||day.nighttime?.precipitation?.probability!==undefined)&&<p className="trend-readout">白天 {percent(day.daytime?.precipitation?.probability)} · 夜间 {percent(day.nighttime?.precipitation?.probability)}</p>}{loading&&!hours.length?<Empty loading/>:error&&!hours.length?<Empty message={error} onRetry={onRetry}/>:<HourMetricChart key={date} hours={hours} prefs={prefs} tz={tz} date={date} metric="rain"/>}</section>{!date&&<section className="glass trend-panel" aria-label="风速趋势"><h3><Wind size={19}/>风速趋势</h3><HourMetricChart hours={hours} prefs={prefs} tz={tz} metric="wind"/></section>}</div>;
}

export function MetricCards({current,day,prefs,tz,onDetails,now}:{current?:WeatherPoint;day?:WeatherPoint;prefs:Preferences;tz:string;onDetails:()=>void;now:string}){
 const c=current;const rise=Date.parse(day?.astro?.sunrise??''),set=Date.parse(day?.astro?.sunset??'');const progress=Number.isFinite(rise)&&Number.isFinite(set)&&set>rise?Math.max(0,Math.min(1,(Date.parse(now)-rise)/(set-rise))):null;
 const uv=c?.uvIndex,uvLabel=!finite(uv)?'暂无数据':uv<3?'低':uv<6?'中等':uv<8?'高':uv<11?'很高':'极高';
 // 体感已在首屏展示，露点并入湿度卡，避免重复占用概览空间。
 const cards=[
  {title:'紫外线指数',icon:Sun,value:numberText(uv),note:uvLabel,art:<div className="uv-track">{finite(uv)&&<span style={{left:`${Math.min(uv/15,1)*100}%`}}/>}</div>},
  {title:'风',icon:Wind,value:windText(c?.wind?.speed,prefs),note:`${compassNames[c?.wind?.direction?.compass??'']??'风向未知'}${finite(c?.wind?.scale)?` · ${c!.wind!.scale} 级`:''}`,art:<div className="compass"><span>北</span><span>东</span><span>南</span><span>西</span>{finite(c?.wind?.direction?.degree)&&<div className="compass-arrow" style={{transform:`rotate(${c!.wind!.direction!.degree}deg)`}}>↑</div>}</div>},
  {title:'湿度',icon:Droplets,value:percent(c?.humidity),note:`露点 ${tempText(c?.dewPoint,prefs)}`,art:<div className="humidity-track">{finite(c?.humidity)&&c!.humidity!<=1&&<span style={{width:`${c!.humidity!*100}%`}}/>}</div>},
  {title:'日出与日落',icon:Sunset,value:localTime(day?.astro?.sunset,tz),note:`日出 ${localTime(day?.astro?.sunrise,tz)}`,art:<svg className="sun-arc" viewBox="0 0 200 65" aria-label="太阳日间进程"><path d="M10 60Q100 -50 190 60" fill="none" stroke="currentColor" opacity=".3" strokeDasharray="3 5"/><path d="M0 55H200" stroke="currentColor" opacity=".2"/>{progress!==null&&<circle cx={10+180*progress} cy={60-220*progress*(1-progress)} r="6" fill="#ffda8c"/>}</svg>},
  {title:'降水量',icon:CloudRain,value:measureText(c?.precipitation?.amount),note:'过去 1 小时',art:null},
  {title:'能见度',icon:Eye,value:visibilityText(c?.visibility),note:'',art:null},
  {title:'海平面气压',icon:Gauge,value:measureText(c?.pressure),note:'',art:null},
  {title:'云量',icon:Cloud,value:percent(c?.cloudCover),note:'',art:null},
  {title:'月相',icon:Moon,value:day?.astro?.moonPhase?(moonNames[day.astro.moonPhase]??day.astro.moonPhase):'—',note:`月升 ${localTime(day?.astro?.moonrise,tz)}`,art:null},
 ];
 return <div className="metrics-grid">{cards.map((m,i)=><button key={m.title} className={`glass metric-card metric-${i}`} onClick={onDetails}><span className="card-label"><m.icon size={14}/>{m.title}<ArrowUpRight size={13} className="metric-arrow"/></span><strong>{m.value}</strong>{m.art}{m.note&&<span className="metric-note">{m.note}</span>}</button>)}</div>;
}
export function SectionTitle({icon:Icon,title,children}:{icon:typeof Sun;title:string;children?:ReactNode}){return <div className="section-title"><h2><Icon size={16} strokeWidth={1.7}/>{title}</h2>{children}</div>;}
export { Sun, Moon, Cloud, Wind, Droplets, CalendarDays, Clock, Sunrise };

/** 每日降水分白天、夜间显示，避免把最高时段概率误称为全天概率。 */
export function DailyRainChart({days,tz}:{days:WeatherPoint[];tz:string}){
 const available=days.some(day=>[day.daytime?.precipitation?.probability,day.nighttime?.precipitation?.probability].some(value=>finite(value)&&value>=0&&value<=1));
 return available?<div className="daily-rain-list">{days.map((day,index)=><div className="daily-rain-row" key={day.forecastStartTime??index}><time dateTime={day.forecastStartTime}>{localDate(day.forecastStartTime,tz).slice(5).replace('-','/')}</time>{(['daytime','nighttime'] as const).map(key=>{const probability=day[key]?.precipitation?.probability;return <div key={key}><span>{fieldNames[key]}</span><span className={`daily-rain-track ${key}`}><i style={{width:finite(probability)&&probability>=0&&probability<=1?`${probability*100}%`:0}}/></span><b>{percent(probability)}</b></div>;})}</div>)}</div>:<Empty message="暂无每日降水概率"/>;
}

/** 两条曲线使用同一真实温度尺度；缺失数据断开，不补出不存在的趋势。 */
export function DailyChart({days,prefs,tz}:{days:WeatherPoint[];prefs:Preferences;tz:string}){
 const [selected,setSelected]=useState<number|null>(null);const lows=days.map(d=>temperature(d.temperatureMin,prefs.temperature)),highs=days.map(d=>temperature(d.temperatureMax,prefs.temperature));
 const all=[...lows,...highs].filter(finite),width=Math.max(600,days.length*65),min=Math.floor(Math.min(...all)-2),max=Math.ceil(Math.max(...all)+2);
 const x=(i:number)=>35+i/Math.max(1,days.length-1)*(width-70),y=(v:number)=>155-(v-min)/(max-min||1)*125;
 function path(values:(number|null)[]){return values.map((v,i)=>v===null?'':`${i===0||values[i-1]===null?'M':'L'}${x(i)},${y(v)}`).join(' ');}
 return <><div className="chart-toolbar"><div className="daily-chart-legend"><span>● 最高温度</span><span>● 最低温度</span></div><span className="chart-selected" aria-live="polite">{selected!==null?`${dayLabel(days[selected].forecastStartTime,tz)} · ${tempText(days[selected].temperatureMin,prefs)} / ${tempText(days[selected].temperatureMax,prefs)}`:''}</span></div>{all.length?<div className="chart-scroll"><svg viewBox={`0 0 ${width} 205`} style={{minWidth:width}} className="weather-chart" role="group" aria-label="未来每日最高与最低温度趋势">{[0,.5,1].map(r=><g key={r}><line x1="35" x2={width-35} y1={30+r*125} y2={30+r*125} className="chart-grid"/><text x="35" y={25+r*125}>{numberText(max-(max-min)*r)}°</text></g>)}<path d={path(highs)} fill="none" stroke="#f6d89d" strokeWidth="2.4"/><path d={path(lows)} fill="none" stroke="#b7e0ee" strokeWidth="2.4"/>{days.map((d,i)=><g key={d.forecastStartTime??i}>{finite(lows[i])&&finite(highs[i])&&<line x1={x(i)} x2={x(i)} y1={y(lows[i]!)} y2={y(highs[i]!)} stroke="#e6f2fc" opacity=".16" strokeWidth="14" strokeLinecap="round"/>}{finite(highs[i])&&<circle cx={x(i)} cy={y(highs[i]!)} r="3.5" fill="#f6d89d"/>}{finite(lows[i])&&<circle cx={x(i)} cy={y(lows[i]!)} r="3.5" fill="#b7e0ee"/>}<text x={x(i)} y="190" textAnchor="middle">{dayLabel(d.forecastStartTime,tz)}</text><rect x={x(i)-25} y="0" width="50" height="180" fill="transparent" tabIndex={0} role="button" aria-label={`${localDate(d.forecastStartTime,tz)} 最低${tempText(d.temperatureMin,prefs)} 最高${tempText(d.temperatureMax,prefs)}`} onMouseEnter={()=>setSelected(i)} onPointerDown={()=>setSelected(i)} onFocus={()=>setSelected(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelected(i);}}/></g>)}</svg></div>:<Empty message="暂无每日温度数据"/>}</>;
}

'use client';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, MapPin } from 'lucide-react';
import { createCalendar, beijingToday, monthCells, addDays, MIN, MAX, type CalendarData, type DayInfo } from '../lib/calendar/calendar.mjs';
import { weatherDateKind } from '../lib/date-weather';
import type { Location } from '../lib/weather';
import { WeatherSelect } from './weather-select';

const week=['日','一','二','三','四','五','六'];
/** 保留原日历的农历、节气与休班算法；只把视图和联动接入天气应用。 */
export function CalendarView({selected,onSelect,onWeather,place,now}:{selected:string;onSelect:(date:string)=>void;onWeather:()=>void;place:Location|null;now:string}){
 const [data,setData]=useState<CalendarData|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const grid=useRef<HTMLDivElement>(null),focusDate=useRef<string|null>(null);
 const calendar=useMemo(()=>data?createCalendar(data):null,[data]);
 const today=now?beijingToday(new Date(now)):selected;
 const [year,month]=selected.split('-').map(Number),cells=monthCells(year,month),info=calendar?.day(selected);
 useEffect(()=>{const controller=new AbortController();setError(false);
  void fetch('/calendar/data.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{const loaded=value as CalendarData;createCalendar(loaded).day(selected);if(!controller.signal.aborted)setData(loaded);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 // 日期变化只重新渲染，不重复下载整份历表。
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[retry]);
 useEffect(()=>{if(focusDate.current===selected){grid.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus({preventScroll:true});focusDate.current=null;}},[selected]);
 function select(date:string,focus=false){if(date<MIN||date>MAX)return;if(focus)focusDate.current=date;onSelect(date);}
 /** 换月夹到月末，避免 31 日溢出到下一个月。 */
 function moveMonth(y:number,m:number){const target=new Date(Date.UTC(y,m-1,1));y=target.getUTCFullYear();m=target.getUTCMonth()+1;if(y<1901||y>2100)return;select(`${y}-${String(m).padStart(2,'0')}-${String(Math.min(Number(selected.slice(-2)),new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`);}
 function keyboard(event:KeyboardEvent,date:string){const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(event.key in offsets){event.preventDefault();select(addDays(date,offsets[event.key]),true);}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();const offset=(calendar!.day(date).weekday+6)%7;select(addDays(date,event.key==='Home'?-offset:6-offset),true);}
  else if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();moveMonth(year,month+(event.key==='PageUp'?-1:1));requestAnimationFrame(()=>grid.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({preventScroll:true}));}
 }
 const lunarNames=calendar?[...new Set(cells.filter((d):d is string=>!!d&&Number(d.slice(5,7))===month).map(d=>calendar.day(d).lunar.monthName))]:[];
 const availability=weatherDateKind(selected,place?.tz??'Asia/Shanghai',now||new Date().toISOString());
 const weatherNote=!place?'选择城市后，查询这一天的天气':availability==='history'?'历史再分析 · 过去 10 天':availability==='forecast'?'每日预报 · 含今天共 10 天':availability==='past'?'超出历史查询范围，可查看查询说明':'预报尚未发布，可查看查询说明';
 return <section className="qingli" aria-label="中国日历">
  <div className="calendar-intro"><div><span className="hero-eyebrow">把日子与天气，放在一起</span><h1>日历</h1></div><p>农历 · 节气 · 休假安排<span>日历以北京时间标记今天</span></p></div>
  <div className="month-toolbar"><div><div className="month-heading"><WeatherSelect label="选择年份" value={String(year)} onChange={value=>moveMonth(Number(value),month)} options={Array.from({length:200},(_,i)=>({value:String(1901+i),label:`${1901+i}年`}))}/><WeatherSelect label="选择月份" value={String(month)} onChange={value=>moveMonth(year,Number(value))} options={Array.from({length:12},(_,i)=>({value:String(i+1),label:`${i+1}月`}))}/></div><p className="month-subtitle">农历{lunarNames.join(' · ')}</p></div><div className="calendar-navigation"><button className="secondary-button" onClick={()=>select(today)}>今天</button><button className="icon-button" aria-label="上个月" disabled={selected.startsWith('1901-01')} onClick={()=>moveMonth(year,month-1)}><ChevronLeft size={19}/></button><button className="icon-button" aria-label="下个月" disabled={selected.startsWith('2100-12')} onClick={()=>moveMonth(year,month+1)}><ChevronRight size={19}/></button></div></div>
  <div className="glass calendar-layout" aria-busy={!calendar&&!error}>
   <div className="weekday-row" aria-hidden="true">{['一','二','三','四','五','六','日'].map(w=><span key={w}>周{w}</span>)}</div>
   <div className="calendar-grid" role="grid" aria-label={`${year}年${month}月日历，方向键选择日期`} aria-colcount={7} ref={grid}>
    {calendar?Array.from({length:cells.length/7},(_,row)=><div className="calendar-row" role="row" key={row}>{cells.slice(row*7,row*7+7).map((date,col)=>{if(!date)return <div key={col} role="gridcell" aria-disabled="true" className="day-cell"/>;const day=calendar.day(date);return <button key={date} role="gridcell" data-date={date} aria-selected={date===selected} aria-current={date===today?'date':undefined} tabIndex={date===selected?0:-1} aria-label={accessibleDate(day,today)} className={`day-cell ${day.month!==month?'is-other':''} ${[0,6].includes(day.weekday)?'is-weekend':''} ${date===today?'is-today':''} ${date===selected?'is-selected':''}`} onClick={()=>select(date,true)} onKeyDown={e=>keyboard(e,date)}>{day.holiday&&<span aria-hidden="true" className={`calendar-badge ${day.holiday.isOffDay?'off':'work'}`}>{day.holiday.isOffDay?'休':'班'}</span>}<span aria-hidden="true" className="day-number">{day.day}</span><span aria-hidden="true" className={`day-label ${day.festivals.length?'festival':day.term?'term':''}`}>{day.festivals[0]||day.term||(day.lunar.day===1?day.lunar.monthName:day.lunar.dayName)}</span></button>;})}</div>):<div className="calendar-loading" role="status">{error?<><p>日历数据暂时无法载入</p><button className="text-button" onClick={()=>setRetry(v=>v+1)}>重新加载</button></>:'正在载入日历…'}</div>}
   </div>
   <div className="calendar-legend"><span>● 今天</span><span>□ 选中</span><span><i className="calendar-badge off">休</i>官方放假</span><span><i className="calendar-badge work">班</i>调休补班</span></div>
   {info&&<div className="date-detail" aria-live="polite"><div><p className="detail-caption">日期详情{selected===today?' · 今天':''}</p><h2>{info.year}年{info.month}月{info.day}日</h2><p>星期{week[info.weekday]}</p></div><div><p className="detail-caption">农历</p><h2>{info.lunar.monthName}{info.lunar.dayName}</h2><p>{info.lunar.ganzhi}{info.lunar.zodiac}年</p></div><section className="detail-section"><h3>节日 · 节气</h3><p>{[...info.festivals,...(info.term?[info.term]:[])].join(' · ')||'当日无节日或节气'}</p></section><section className="detail-section"><h3>休假安排</h3><p>{info.holiday?`${info.holiday.name} · ${info.holiday.isOffDay?'官方放假':'调休补班'}`:!data?.holidays[info.year]?(info.year>2026?'休假安排待更新':'休假数据未收录'):[0,6].includes(info.weekday)?'普通周末':'工作日'}</p><small>{info.statutory||(!data?.holidays[info.year]?'仅展示日期、农历和节日，不推算休班':'以已收录官方安排为准')}</small></section></div>}
  </div>
  <div className="glass calendar-weather-link"><div><span><MapPin size={15}/>{place?.name??'尚未选择城市'} · {selected}</span><p>{weatherNote}</p></div><button className="primary-button" onClick={onWeather}>查看当天天气<ArrowRight size={16}/></button></div>
 </section>;
}
/** 无障碍名称包含网格中被优先级隐藏的节日和休班信息。 */
function accessibleDate(day:DayInfo,today:string){return `${day.year}年${day.month}月${day.day}日，星期${week[day.weekday]}，农历${day.lunar.full}${day.festivals.length?'，'+day.festivals.join('，'):''}${day.term?'，'+day.term:''}${day.holiday?'，'+day.holiday.name+(day.holiday.isOffDay?'放假':'调休补班'):''}${day.date===today?'，今天':''}`;}

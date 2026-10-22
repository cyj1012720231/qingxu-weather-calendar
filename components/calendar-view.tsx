'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { createCalendar, beijingToday, monthCells, shiftMonth, addDays, MIN, MAX, type CalendarData, type DayInfo } from '../lib/calendar/calendar.mjs';
import { createLongPress } from '../lib/gestures';
import { WeatherSelect } from './weather-select';
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover';

const week=['日','一','二','三','四','五','六'];
const monthWindow=(date:string)=>({start:shiftMonth(`${date.slice(0,7)}-01`,-3),end:shiftMonth(`${date.slice(0,7)}-01`,3)});
/** 农历沿用原历表；按需添加相邻月份，让触摸与滚轮使用浏览器原生滚动。 */
export function CalendarView({selected,onSelect,onWeather,now}:{selected:string;onSelect:(date:string)=>void;onWeather:(date:string)=>void;now:string}){
 const [data,setData]=useState<CalendarData|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [range,setRange]=useState(()=>monthWindow(selected)),[visibleMonth,setVisibleMonth]=useState(selected.slice(0,7));
 const scroller=useRef<HTMLDivElement>(null),focusDate=useRef<string|null>(null);
 const pendingScroll=useRef<{month:string;offset:number}|null>({month:selected.slice(0,7),offset:0});
 const [weatherDate,setWeatherDate]=useState<string|null>(null);
 const press=useMemo(()=>createLongPress(),[]),anchor=useRef<{getBoundingClientRect:()=>DOMRect}|null>(null),keyboardOpen=useRef(false);
 const calendar=useMemo(()=>data?createCalendar(data):null,[data]);
 const today=now?beijingToday(new Date(now)):selected;
 const [year,month]=visibleMonth.split('-').map(Number),info=calendar?.day(selected);
 const months=useMemo(()=>{
  const [startYear,startMonth]=range.start.split('-').map(Number),[endYear,endMonth]=range.end.split('-').map(Number);
  return Array.from({length:(endYear-startYear)*12+endMonth-startMonth+1},(_,index)=>{
   const key=shiftMonth(range.start,index).slice(0,7),[y,m]=key.split('-').map(Number);
   // 每个日期只出现在所属月份，避免跨月重复选择与浮层定位歧义。
   return {key,year:y,month:m,cells:monthCells(y,m).map(date=>date?.startsWith(key)?date:null)};
  });
 },[range]);
 useEffect(()=>{
  const dismiss=()=>{press.cancel();setWeatherDate(null);};
  window.addEventListener('scroll',dismiss,true);window.addEventListener('resize',dismiss);
  return()=>{press.cancel();window.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);};
 },[press]);
 useEffect(()=>{const controller=new AbortController();
  void fetch('/calendar/data.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{const loaded=value as CalendarData;createCalendar(loaded).day(selected);if(!controller.signal.aborted)setData(loaded);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 // 日期变化只重新渲染，不重复下载整份历表。
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[retry]);
 useLayoutEffect(()=>{
  const viewport=scroller.current;if(!viewport||!calendar)return;
  const pending=pendingScroll.current;
  if(pending){const target=viewport.querySelector<HTMLElement>(`[data-month="${pending.month}"]`);if(target){viewport.scrollTop=target.offsetTop+pending.offset;pendingScroll.current=null;}}
  if(focusDate.current===selected){
   const cell=viewport.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`);
   if(cell){cell.focus({preventScroll:true});const bounds=viewport.getBoundingClientRect(),rect=cell.getBoundingClientRect();if(rect.top<bounds.top)viewport.scrollTop-=bounds.top-rect.top;else if(rect.bottom>bounds.bottom)viewport.scrollTop+=rect.bottom-bounds.bottom;focusDate.current=null;}
  }
 },[calendar,range,selected]);
 /** 向上补月前记录现有月份的位置，补完后抵消新增高度，避免内容跳动。 */
 function scrollMonths(){
  const viewport=scroller.current;if(!viewport||pendingScroll.current)return;
  const sections=Array.from(viewport.querySelectorAll<HTMLElement>('[data-month]'));
  const active=sections.findLast(section=>section.offsetTop<=viewport.scrollTop+Math.min(80,viewport.clientHeight*.2));
  if(active?.dataset.month)setVisibleMonth(active.dataset.month);
  if(viewport.scrollTop<viewport.clientHeight&&range.start>MIN){
   const first=sections[0];if(!first)return;
   pendingScroll.current={month:first.dataset.month!,offset:viewport.scrollTop-first.offsetTop};
   setRange(current=>({...current,start:shiftMonth(current.start,-3)}));
  }else if(viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<viewport.clientHeight&&range.end<MAX.slice(0,7)+'-01'){
   setRange(current=>({...current,end:shiftMonth(current.end,3)}));
  }
 }
 /** 普通点选保持阅读位置；年月跳转和“今天”才滚动定位。 */
 function select(date:string,focus=false,reveal=false){
  if(date<MIN||date>MAX)return;
  setWeatherDate(null);if(focus)focusDate.current=date;onSelect(date);
  const key=date.slice(0,7),target=scroller.current?.querySelector<HTMLElement>(`[data-month="${key}"]`);
  if(!target){pendingScroll.current={month:key,offset:0};setRange(monthWindow(date));setVisibleMonth(key);}
  else if(reveal&&scroller.current){scroller.current.scrollTop=target.offsetTop;setVisibleMonth(key);}
 }
 /** 用实际日期格定位浮层，滚动时关闭，避免浮层脱离日期。 */
 function openWeather(date:string,keyboard=false){
  const cell=scroller.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);if(!cell)return;
  const rect=cell.getBoundingClientRect();
  anchor.current={getBoundingClientRect:()=>scroller.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.getBoundingClientRect()??rect};
  keyboardOpen.current=keyboard;select(date);setWeatherDate(date);
 }
 function moveMonth(y:number,m:number){
  const target=new Date(Date.UTC(y,m-1,1));if(target.getUTCFullYear()<1901||target.getUTCFullYear()>2100)return;
  const [selectedYear,selectedMonth]=selected.split('-').map(Number);
  select(shiftMonth(selected,(y-selectedYear)*12+m-selectedMonth),false,true);
 }
 /** 事件发生时从日期格取值，避免滚动补月后复用旧格的日期。 */
 function startPress(event:PointerEvent<HTMLButtonElement>){
  const date=event.currentTarget.dataset.date!;
  if(event.isPrimary&&event.button===0)press.start(event.clientX,event.clientY,()=>openWeather(date));else press.cancel();
 }
 function openContext(event:MouseEvent<HTMLButtonElement>){event.preventDefault();press.end();openWeather(event.currentTarget.dataset.date!);}
 function clickDate(event:MouseEvent<HTMLButtonElement>){
  if(press.consumeClick()){event.preventDefault();return;}
  const date=event.currentTarget.dataset.date!;
  if(event.detail===0)openWeather(date,true);else select(date,true);
 }
 /** 连续月历保留方向键、跨月翻页与键盘打开天气的等价入口。 */
 function keyboard(event:KeyboardEvent<HTMLButtonElement>){const date=event.currentTarget.dataset.date!;const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();openWeather(date,true);}
  else if(event.key in offsets){event.preventDefault();select(addDays(date,offsets[event.key]),true);}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();const offset=(calendar!.day(date).weekday+6)%7;select(addDays(date,event.key==='Home'?-offset:6-offset),true);}
  else if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();select(shiftMonth(date,event.key==='PageUp'?-1:1),true,true);}
 }
 return <section className="qingli" aria-label="中国日历">
  <p id="calendar-day-actions" className="sr-only">上下滚动浏览月份；长按查看天气；键盘按 Enter 打开日期操作。</p>
  <div className="glass calendar-layout" aria-busy={!calendar&&!error}>
   <div className="month-toolbar">
    <div className="month-heading"><WeatherSelect label="选择年份" value={String(year)} onChange={value=>moveMonth(Number(value),month)} options={Array.from({length:200},(_,i)=>({value:String(1901+i),label:`${1901+i}年`}))}/><WeatherSelect label="选择月份" value={String(month)} onChange={value=>moveMonth(year,Number(value))} options={Array.from({length:12},(_,i)=>({value:String(i+1),label:`${i+1}月`}))}/></div>
    <div className="calendar-navigation"><button className="icon-button" aria-label="上个月" disabled={visibleMonth==='1901-01'} onClick={()=>moveMonth(year,month-1)}><ChevronLeft size={19}/></button><button className="calendar-today" onClick={()=>select(today,false,true)}>今天</button><button className="icon-button" aria-label="下个月" disabled={visibleMonth==='2100-12'} onClick={()=>moveMonth(year,month+1)}><ChevronRight size={19}/></button></div>
    <p className="month-subtitle" aria-live="polite" aria-atomic="true">农历 {info?`${info.lunar.monthName}${info.lunar.dayName}`:'—'}</p>
   </div>
   <div className="weekday-row" aria-hidden="true">{['一','二','三','四','五','六','日'].map(w=><span key={w}>周{w}</span>)}</div>
   <div className="calendar-scroller" role="region" aria-label="连续月历" tabIndex={0} ref={scroller} onScroll={scrollMonths}>
    {calendar?months.map(entry=><section className="calendar-month" data-month={entry.key} key={entry.key} aria-label={`${entry.year}年${entry.month}月`}>
     <h2 className={`calendar-month-title ${entry.key===today.slice(0,7)?'is-current-month':''}`}>{entry.month===1?`${entry.year}年 `:''}{entry.month}月</h2>
     <div className="calendar-grid" role="grid" aria-label={`${entry.year}年${entry.month}月日历，方向键选择日期`} aria-colcount={7}>
      {Array.from({length:entry.cells.length/7},(_,row)=><div className="calendar-row" role="row" key={row}>{entry.cells.slice(row*7,row*7+7).map((date,col)=>{
       if(!date)return <div key={col} role="gridcell" aria-disabled="true" className="day-cell empty"/>;
       const day=calendar.day(date);
       return <button key={date} role="gridcell" data-date={date} aria-selected={date===selected} aria-current={date===today?'date':undefined} tabIndex={date===selected?0:-1} aria-label={accessibleDate(day,today)} className={`day-cell ${[0,6].includes(day.weekday)?'is-weekend':''} ${date===today?'is-today':''} ${date===selected?'is-selected':''}`} aria-haspopup="dialog" aria-expanded={weatherDate===date} aria-describedby="calendar-day-actions" onPointerDown={startPress} onPointerMove={e=>press.move(e.clientX,e.clientY)} onPointerUp={()=>press.end()} onPointerCancel={()=>press.cancel()} onPointerLeave={()=>press.cancel()} onContextMenu={openContext} onClick={clickDate} onKeyDown={keyboard}>
        {day.holiday&&<span aria-hidden="true" className={`calendar-badge ${day.holiday.isOffDay?'off':'work'}`}>{day.holiday.isOffDay?'休':'班'}</span>}
        {date===today&&<span aria-hidden="true" className="calendar-badge today">今</span>}
        <span aria-hidden="true" className="day-number">{day.day}</span><span aria-hidden="true" className={`day-label ${day.festivals.length?'festival':day.term?'term':''}`}>{day.festivals[0]||day.term||(day.lunar.day===1?day.lunar.monthName:day.lunar.dayName)}</span>
       </button>;
      })}</div>)}
     </div>
    </section>):<div className="calendar-loading" role="status">{error?<><p>日历数据暂时无法载入</p><button className="text-button" onClick={()=>{setError(false);setRetry(v=>v+1);}}>重新加载</button></>:'正在载入日历…'}</div>}
   </div>
  </div>
  <Popover open={weatherDate!==null} onOpenChange={open=>{if(!open)setWeatherDate(null);}}>
   <PopoverAnchor virtualRef={anchor}/>
   <PopoverContent className="calendar-weather-popover" side="top" sideOffset={8} collisionPadding={12} aria-label={`${weatherDate}的日期操作`} onOpenAutoFocus={event=>{if(!keyboardOpen.current)event.preventDefault();}} onCloseAutoFocus={event=>{event.preventDefault();if(keyboardOpen.current)scroller.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus({preventScroll:true});}}>
    <button onClick={()=>{if(weatherDate){setWeatherDate(null);onWeather(weatherDate);}}}>查看当天天气<ArrowRight size={17}/></button>
   </PopoverContent>
  </Popover>
 </section>;
}
/** 无障碍名称包含网格中被优先级隐藏的节日和休班信息。 */
function accessibleDate(day:DayInfo,today:string){return `${day.year}年${day.month}月${day.day}日，星期${week[day.weekday]}，农历${day.lunar.full}${day.festivals.length?'，'+day.festivals.join('，'):''}${day.term?'，'+day.term:''}${day.holiday?'，'+day.holiday.name+(day.holiday.isOffDay?'放假':'调休补班'):''}${day.date===today?'，今天':''}`;}

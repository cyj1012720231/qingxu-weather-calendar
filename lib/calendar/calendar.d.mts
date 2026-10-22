export type CalendarData={months:[string,number,number][];terms:Record<string,string>;holidays:Record<string,{days:Record<string,[string,boolean]>}>};
export type DayInfo={date:string;year:number;month:number;day:number;weekday:number;lunar:{year:number;month:number;day:number;leap:boolean;monthName:string;dayName:string;ganzhi:string;zodiac:string;full:string};festivals:string[];term:string|null;holiday:{name:string;isOffDay:boolean}|null;statutory:string|null};
export const MIN:string,MAX:string;
export function beijingToday(now?:Date):string;
export function addDays(date:string,count:number):string;
export function shiftMonth(date:string,offset:number):string;
export function monthCells(year:number,month:number):(string|null)[];
export function createCalendar(data:CalendarData):{day:(date:string)=>DayInfo};

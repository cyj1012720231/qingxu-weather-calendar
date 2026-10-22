import { localDate, localTime, type WeatherPoint } from './weather.ts';

/** 用城市的民用日期比较天数，避免电脑时区及夏令时改变查询窗口。 */
export function weatherDateKind(date:string,tz:string,now=new Date().toISOString()){
 const time=Date.parse(date),today=localDate(now,tz);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date||today==='—')return 'invalid';
 const offset=(time-Date.parse(today))/86400000;
 return offset < -10?'past':offset<0?'history':offset<10?'forecast':'future';
}

/** 精确匹配日期；上游缺少该日时不得回退成今天或相邻日期。 */
export const forecastForDate=(days:WeatherPoint[],date:string,tz:string)=>days.find(day=>localDate(day.forecastStartTime,tz)===date);

/** 以民用日期生成切换栏；不可查询日期仍保留原选择，不跳到今天。 */
export function weatherDates(date:string,tz:string,now:string){
 const kind=weatherDateKind(date,tz,now);
 if(kind==='invalid')return [];
 const available=kind==='history'||kind==='forecast';
 const start=Date.parse(available?localDate(now,tz):date)-(available?10:3)*86400000;
 return Array.from({length:available?20:7},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
}

// 历史接口的时间已是城市当地时间且不带偏移，不能再按浏览器时区转换。
const civilTime=/^\d{4}-\d{2}-\d{2}[ T](?:[01]\d|2[0-3]):[0-5]\d$/;
export const weatherHourTime=(hour:WeatherPoint,tz:string)=>civilTime.test(hour.forecastTime??'')?hour.forecastTime!.slice(11,16):localTime(hour.forecastTime,tz);
export function hoursForDate(hours:WeatherPoint[],date:string,tz:string){
 return hours.filter(hour=>(civilTime.test(hour.forecastTime??'')?hour.forecastTime!.slice(0,10):localDate(hour.forecastTime,tz))===date).sort((a,b)=>weatherHourTime(a,tz).localeCompare(weatherHourTime(b,tz)));
}

/** 旧预报不冒充实况；没有取得的早间时段明确保留为空缺。 */
export function pastHoursNote(hours:WeatherPoint[],hasPast:boolean,date:string,tz:string,now:string){
 if(date!==localDate(now,tz))return undefined;
 const first=hours[0]&&weatherHourTime(hours[0],tz);
 const missing=first&&first!=='00:00'?`00:00–${first} 暂无已保存预报。`:'';
 return [hasPast?'过去时段为此前预报，非历史实况。':'',missing].filter(Boolean).join('')||undefined;
}

/** 历史接口使用字符串和百分数，转换到现有展示结构时保留缺失值。 */
export function normalizeHistory(body:Record<string,unknown>):WeatherPoint{
 const day=body.weatherDaily as Record<string,unknown>|undefined;
 if(!day||typeof day!=='object'||Array.isArray(day)||typeof day.date!=='string')throw new Error('历史天气格式异常');
 const number=(value:unknown)=>typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value)?Number(value):undefined;
 const measure=(value:unknown,unit:string)=>{const n=number(value);return n===undefined?undefined:{value:n,unit};};
 const humidity=number(day.humidity);
 const refer=body.refer as {sources?:unknown;license?:unknown}|undefined;
 const attributions=[refer?.sources,refer?.license].flatMap(value=>Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'):[]);
 const hours=Array.isArray(body.weatherHourly)?body.weatherHourly.flatMap((hour:unknown)=>{
  if(!hour||typeof hour!=='object')return [];
  const h=hour as Record<string,unknown>;
  if(typeof h.time!=='string'||h.time.slice(0,10)!==day.date)return [];
  // 当前历史响应带时区偏移，同时兼容旧响应的当地时间字符串。
  if(!civilTime.test(h.time)&&!(/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(h.time)&&Number.isFinite(Date.parse(h.time))))return [];
  return [{forecastTime:h.time,temperature:measure(h.temp,'°C'),condition:{code:typeof h.icon==='string'?h.icon:undefined,text:typeof h.text==='string'?h.text:undefined},precipitation:{amount:measure(h.precip,'mm')}}];
 }):undefined;
 return {date:day.date,temperatureMax:measure(day.tempMax,'°C'),temperatureMin:measure(day.tempMin,'°C'),humidity:humidity===undefined?undefined:humidity/100,precipitation:{amount:measure(day.precip,'mm')},stationPressure:measure(day.pressure,'hPa'),hours,metadata:{attributions}};
}

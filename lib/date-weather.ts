import { localDate, type WeatherPoint } from './weather.ts';

/** 用城市的民用日期比较天数，避免电脑时区及夏令时改变查询窗口。 */
export function weatherDateKind(date:string,tz:string,now=new Date().toISOString()){
 const time=Date.parse(date),today=localDate(now,tz);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date||today==='—')return 'invalid';
 const offset=(time-Date.parse(today))/86400000;
 return offset < -10?'past':offset<0?'history':offset<10?'forecast':'future';
}

/** 精确匹配日期；上游缺少该日时不得回退成今天或相邻日期。 */
export const forecastForDate=(days:WeatherPoint[],date:string,tz:string)=>days.find(day=>localDate(day.forecastStartTime,tz)===date);

/** 历史接口使用字符串和百分数，转换到现有展示结构时保留缺失值。 */
export function normalizeHistory(body:Record<string,unknown>):WeatherPoint{
 const day=body.weatherDaily as Record<string,unknown>|undefined;
 if(!day||typeof day!=='object'||Array.isArray(day)||typeof day.date!=='string')throw new Error('历史天气格式异常');
 const number=(value:unknown)=>typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value)?Number(value):undefined;
 const measure=(value:unknown,unit:string)=>{const n=number(value);return n===undefined?undefined:{value:n,unit};};
 const humidity=number(day.humidity);
 const refer=body.refer as {sources?:unknown;license?:unknown}|undefined;
 const attributions=[refer?.sources,refer?.license].flatMap(value=>Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'):[]);
 return {date:day.date,temperatureMax:measure(day.tempMax,'°C'),temperatureMin:measure(day.tempMin,'°C'),humidity:humidity===undefined?undefined:humidity/100,precipitation:{amount:measure(day.precip,'mm')},stationPressure:measure(day.pressure,'hPa'),metadata:{attributions}};
}

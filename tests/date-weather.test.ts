import test from 'node:test';
import assert from 'node:assert/strict';
import * as dateWeather from '../lib/date-weather.ts';
import { weatherPath } from '../lib/qweather-server.ts';

const now='2026-10-20T01:00:00Z';
test('按地点时区区分历史、预报与不可查询日期，拒绝溢出日期',()=>{
 for(const [date,want] of [['2026-10-20','forecast'],['2026-10-29','forecast'],['2026-10-30','future'],['2026-10-10','history'],['2026-10-09','past'],['2026-02-30','invalid']])assert.equal(dateWeather.weatherDateKind(date,'Asia/Shanghai',now),want);
 assert.equal(dateWeather.weatherDateKind('2026-10-29','America/Los_Angeles',now),'future');
});
test('查询选中日期绝不使用相邻日期或访客时区的预报',()=>{
 const days=[{forecastStartTime:'2026-10-20T23:00:00-07:00'},{forecastStartTime:'2026-10-21T00:00:00-07:00'}];
 assert.equal(dateWeather.forecastForDate(days,'2026-10-20','America/Los_Angeles'),days[0]);
 assert.equal(dateWeather.forecastForDate(days,'2026-10-22','America/Los_Angeles'),undefined);
});
test('历史路径只接受有效城市ID和过去十天，参数不得注入上游路径',()=>{
 assert.equal(weatherPath(new URLSearchParams('kind=history&location=101010100&date=2026-10-19&tz=Asia%2FShanghai'),Date.parse(now)), '/v7/historical/weather?location=101010100&date=20261019&lang=zh&unit=m');
 for(const query of ['date=2026-10-20','date=2026-10-09','date=2026-02-30','date=2026-10-19&url=https://evil.test'])assert.throws(()=>weatherPath(new URLSearchParams('kind=history&location=101010100&tz=Asia%2FShanghai&'+query),Date.parse(now)));
 assert.throws(()=>weatherPath(new URLSearchParams('kind=history&location=gps:1,2&date=2026-10-19&tz=Asia%2FShanghai'),Date.parse(now)));
});
test('历史数值保留零和缺失，空字符串不产生假温度，来源不会丢失',()=>{
 const result=dateWeather.normalizeHistory({weatherDaily:{date:'2026-10-19',tempMax:'0',tempMin:'',humidity:'50',precip:'0',pressure:'1010'},refer:{sources:['QWeather'],license:['license']}});
 assert.deepEqual(result.temperatureMax,{value:0,unit:'°C'});
 assert.equal(result.temperatureMin,undefined);
 assert.equal(result.humidity,.5);
 assert.deepEqual(result.precipitation?.amount,{value:0,unit:'mm'});
 assert.deepEqual(result.metadata?.attributions,['QWeather','license']);
 assert.throws(()=>dateWeather.normalizeHistory({weatherDaily:null}));
});

test('日期条覆盖本地历史及预报窗口，跨月与夏令时不丢日期',()=>{
 const dates=dateWeather.weatherDates('2026-11-01','America/New_York','2026-11-01T05:00:00Z');
 assert.equal(dates.length,20);assert.equal(dates[0],'2026-10-22');assert.equal(dates.at(-1),'2026-11-10');
 assert.equal(new Set(dates).size,20);
 assert.ok(dateWeather.weatherDates('2028-02-29','Asia/Shanghai',now).includes('2028-02-29'));
});

test('逐小时数据按城市日期筛选排序，历史当地时间不受电脑时区影响',()=>{
 const hours=[{forecastTime:'2026-10-22T00:00:00+08:00'},{forecastTime:'2026-10-21T15:00:00Z'},{forecastTime:'2026-10-21T02:00:00+08:00'},{forecastTime:'invalid'}];
 assert.deepEqual(dateWeather.hoursForDate(hours,'2026-10-21','Asia/Shanghai'),[hours[2],hours[1]]);
 const historic=dateWeather.normalizeHistory({weatherDaily:{date:'2026-10-19'},weatherHourly:[{time:'2026-10-19 00:00',temp:'0',precip:'0'},{time:'2026-10-19 01:00',temp:''}]});
 assert.equal(historic.hours?.length,2);
 assert.equal(dateWeather.hoursForDate(historic.hours??[],'2026-10-19','America/Los_Angeles').length,2);
 assert.equal(dateWeather.weatherHourTime(historic.hours![0],'America/Los_Angeles'),'00:00');
 assert.deepEqual(historic.hours?.[0].temperature,{value:0,unit:'°C'});
 assert.equal(historic.hours?.[1].temperature,undefined);
 assert.equal(historic.hours?.[0].precipitation?.probability,undefined);
 const zoned=dateWeather.normalizeHistory({weatherDaily:{date:'2026-10-20'},weatherHourly:[{time:'2026-10-20T00:00+08:00',temp:'12',precip:'0.0'},{time:'invalid',temp:'99'}]});
 assert.equal(zoned.hours?.length,1);
 assert.equal(dateWeather.hoursForDate(zoned.hours??[],'2026-10-20','Asia/Shanghai').length,1);
 assert.equal(dateWeather.weatherHourTime(zoned.hours![0],'Asia/Shanghai'),'00:00');
});

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

import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../lib/weather-client.ts';
import {validLocation,parsePreferences} from '../lib/weather.ts';
import type {ApiResult} from '../lib/weather.ts';
test('本地偏好校验不会将畸形存储作为城市或单位',()=>{
 assert.equal(validLocation({id:'x',name:'测试',adm1:'',adm2:'',country:'',lat:0,lon:0,tz:'Invalid/Zone'}),false);
 assert.equal(parsePreferences({temperature:'K',wind:'bad',theme:'bad'}).temperature,'C');
});
test('Geo字段明确转换为数字，经纬度无效或时区无效的结果被排除',()=>{
 assert.deepEqual(client.parseLocations({location:[{id:'1B6D3',name:'区',adm1:'省',adm2:'市',country:'中国',lat:'39.92',lon:'116.41',tz:'Asia/Shanghai'},{id:'bad',lat:'',lon:'0',tz:'UTC'}]}),[{id:'1B6D3',name:'区',adm1:'省',adm2:'市',country:'中国',lat:39.92,lon:116.41,tz:'Asia/Shanghai'}]);
});
test('定位错误涵盖拒绝、超时、不可用和HTTPS限制',()=>{
 assert.match(client.geolocationMessage({code:1}),/权限/);
 assert.match(client.geolocationMessage({code:2}),/获取/);
 assert.match(client.geolocationMessage({code:3}),/超时/);
});

test('同一查询刷新保留现有数据，换查询清空旧结果，中止响应不能覆盖新数据',async()=>{
 const original:ApiResult={data:{temperature:{value:10,unit:'°C'}},fetchedAt:'2026-10-21T00:00:00Z',cached:false,stale:false};
 let slot:client.WeatherSlot={key:'beijing',result:original,loading:false};
 const update=(change:(old:client.WeatherSlot)=>client.WeatherSlot)=>{slot=change(slot);};
 let resolve!:(result:ApiResult)=>void;
 const controller=new AbortController();
 const loading=client.loadWeather('beijing',()=>new Promise<ApiResult>(done=>{resolve=done;}),controller.signal,update);
 assert.equal(slot.result,original);assert.equal(slot.loading,true);
 const fresh={...original,data:{temperature:{value:12,unit:'°C'}}};
 resolve(fresh);await loading;assert.equal(slot.result,fresh);assert.equal(slot.loading,false);
 const obsolete=client.loadWeather('shanghai',()=>new Promise<ApiResult>(done=>{resolve=done;}),controller.signal,update);
 assert.equal(slot.result,undefined);
 controller.abort();slot={key:'guangzhou',result:fresh,loading:false};resolve(original);await obsolete;
 assert.equal(slot.key,'guangzhou');assert.equal(slot.result,fresh);
});

test('刷新失败保留旧内容并标记缓存，不能把失败显示为新数据',async()=>{
 const original:ApiResult={data:{temperature:{value:10,unit:'°C'}},fetchedAt:'2026-10-21T00:00:00Z',cached:false,stale:false};
 let slot:client.WeatherSlot={key:'beijing',result:original,loading:false};
 await client.loadWeather('beijing',async()=>{throw new client.RequestError('暂时断网');},new AbortController().signal,change=>{slot=change(slot);});
 assert.equal(slot.result?.data,original.data);assert.equal(slot.result?.fetchedAt,original.fetchedAt);assert.equal(slot.result?.stale,true);
 assert.equal(slot.loading,false);assert.match(slot.result?.warning??'',/暂时断网/);
});

test('手动刷新通过请求头重验证，仍能回退同一查询的客户端缓存',async()=>{
 const originalFetch=globalThis.fetch;
 const url='/api/weather?kind=current&lat=12&lon=34';
 let header:string|null=null;
 try{
  globalThis.fetch=async(_input,init)=>{header=new Headers(init?.headers).get('Cache-Control');return Response.json({data:{temperature:{value:18,unit:'°C'}},fetchedAt:new Date().toISOString(),cached:false,stale:false});};
  await client.request(url,undefined,true);assert.equal(header,'no-cache');
  globalThis.fetch=async()=>{throw Error('offline');};
  const cached=await client.request<ApiResult>(url,undefined,true);assert.equal(cached.data.temperature?.value,18);assert.equal(cached.stale,true);
 }finally{globalThis.fetch=originalFetch;}
});

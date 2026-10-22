import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../lib/qweather-server.ts';

test('限流默认忽略来路不明的代理头与旧平台身份，可信代理仅接受合法单个IP',()=>{
 const headers=new Headers({'x-real-ip':'203.0.113.10','x-forwarded-for':'198.51.100.20','cf-connecting-ip':'192.0.2.1','oai-authenticated-user-id':'fake-user'});
 assert.equal(api.requestRateLimitKey(headers,false),'shared');
 assert.equal(api.requestRateLimitKey(headers,true),'ip:203.0.113.10');
 headers.set('x-real-ip','2001:db8::1');
 assert.equal(api.requestRateLimitKey(headers,true),'ip:2001:db8::1');
 for(const invalid of ['not-an-ip','203.0.113.10, 198.51.100.20','']){
  headers.set('x-real-ip',invalid);assert.equal(api.requestRateLimitKey(headers,true),'shared');
 }
});

test('固定v1路径使用纬度在前与两位精度，预报长度边界严格校验',()=>{
 assert.equal(api.weatherPath(new URLSearchParams('kind=hourly&lat=39.91755&lon=116.41876&hours=240')),'/weather/v1/hourly/39.92/116.42?localTime=true&lang=zh&hours=240');
 assert.equal(api.weatherPath(new URLSearchParams('kind=daily&lat=0&lon=0&days=10')),'/weather/v1/daily/0.00/0.00?localTime=true&lang=zh&days=10');
 for(const q of ['kind=current&lat=&lon=0','kind=current&lat=91&lon=0','kind=hourly&lat=0&lon=0&hours=241','kind=daily&lat=0&lon=0&days=0','kind=v7&lat=0&lon=0','kind=current&lat=0&lon=0&url=https://evil.test','kind=hourly&lat=0&lon=0&hours=1.5'])assert.throws(()=>api.weatherPath(new URLSearchParams(q)));
});
test('GeoAPI反查保持经度在前，禁止任意目标与非法参数',()=>{
 assert.equal(api.geoPath(new URLSearchParams('q=116.41,39.92')),'/geo/v2/city/lookup?location=116.41%2C39.92&number=20&lang=zh');
 assert.throws(()=>api.geoPath(new URLSearchParams('q=a&url=https://evil.test')));
 assert.throws(()=>api.apiHost('https://example.com'));
 assert.throws(()=>api.apiHost('x.qweatherapi.com.evil.test'));
 assert.throws(()=>api.apiHost('user:pass@x.qweatherapi.com'));
 assert.equal(api.apiHost('sample.xy.qweatherapi.com'),'https://sample.xy.qweatherapi.com');
});
test('JWT用Ed25519验证签名，包含新版iss/sub及短期有效期',async()=>{
 const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const der=await crypto.subtle.exportKey('pkcs8',keys.privateKey);
 const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(der).toString('base64')+'\n-----END PRIVATE KEY-----';
 const token=await api.signJwt({QWEATHER_KID:'test-kid',QWEATHER_ISS:'test-issuer',QWEATHER_SUB:'test-project',QWEATHER_PRIVATE_KEY:pem},1800000000000);
 const [header,payload,signature]=token.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(header,'base64url').toString()),{alg:'EdDSA',kid:'test-kid'});
 assert.deepEqual(JSON.parse(Buffer.from(payload,'base64url').toString()),{iss:'test-issuer',sub:'test-project',iat:1799999970,exp:1800000900});
 assert.equal(await crypto.subtle.verify('Ed25519',keys.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(header+'.'+payload)),true);
});
test('缺配置返回明确状态，不能发送上游请求',async()=>{
 let called=false;const client=api.createClient({},async()=>{called=true;throw Error('不应发送');});
 await assert.rejects(client.get('/weather/v1/current/0.00/0.00?localTime=true&lang=zh'),{code:'CONFIG_MISSING'});
 assert.equal(called,false);
});

async function testEnv(){
 const k=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);const d=await crypto.subtle.exportKey('pkcs8',k.privateKey);
 return {QWEATHER_API_HOST:'sample.xy.qweatherapi.com',QWEATHER_KID:'test-kid',QWEATHER_ISS:'test-issuer',QWEATHER_SUB:'test-project',QWEATHER_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(d).toString('base64')+'\n-----END PRIVATE KEY-----'};
}
const currentPath='/weather/v1/current/39.92/116.42?localTime=true&lang=zh';
test('相同天气请求去重、缓存过期失败标注旧数据且不会跨地点回退',async()=>{
 let now=1800000000000,calls=0,fail=false;
 const client=api.createClient(await testEnv(),async()=>{calls++;if(fail)throw Error('offline');return Response.json({condition:{code:'100',text:'测试样本'},temperature:{value:12.5,unit:'°C'},metadata:{attributions:[]}});},()=>now);
 const [a,b]=await Promise.all([client.get(currentPath),client.get(currentPath)]);assert.equal(calls,1);assert.equal(a.data.temperature?.value,12.5);assert.equal(b.stale,false);
 await client.get(currentPath);assert.equal(calls,1);
 now+=301000;fail=true;const stale=await client.get(currentPath);assert.equal(stale.stale,true);assert.equal(stale.fetchedAt,a.fetchedAt);
 await assert.rejects(client.get('/weather/v1/current/31.23/121.47?localTime=true&lang=zh'),{code:'NETWORK_ERROR'});
 now+=21600001;await assert.rejects(client.get(currentPath),{code:'NETWORK_ERROR'});
});
test('240小时和10天完整数据保留，不按旧字段解析',async()=>{
 const client=api.createClient(await testEnv(),async input=>{const url=new URL(String(input));return Response.json(url.pathname.includes('/hourly/')?{hours:Array.from({length:240},(_,i)=>({forecastTime:new Date(1800000000000+i*3600000).toISOString(),temperature:{value:i/10,unit:'°C'}}))}:{days:Array.from({length:10},(_,i)=>({forecastStartTime:new Date(1800000000000+i*86400000).toISOString(),daytime:{humidity:.6},nighttime:{humidity:.8}}))});});
 const hourly=await client.get(api.weatherPath(new URLSearchParams('kind=hourly&lat=0&lon=0&hours=240')));assert.equal(hourly.data.hours?.length,240);assert.equal(hourly.data.hours?.[239].temperature?.value,23.9);
 const daily=await client.get(api.weatherPath(new URLSearchParams('kind=daily&lat=0&lon=0&days=10')));assert.equal(daily.data.days?.length,10);assert.equal(daily.data.days?.[9].nighttime?.humidity,.8);
});
test('手动刷新绕过有效缓存、合并并发请求，失败仍返回有时间标记的旧数据',async()=>{
 let calls=0,fail=false,now=1800000000000;
 const client=api.createClient(await testEnv(),async()=>{calls++;return fail?Response.json({error:{type:'unavailable'}},{status:503}):Response.json({temperature:{value:calls,unit:'°C'}});},()=>now);
 await client.get(currentPath);
 now+=1000;
 const [fresh,duplicate]=await Promise.all([client.get(currentPath,true),client.get(currentPath,true)]);
 assert.equal(fresh.data.temperature?.value,2);assert.equal(duplicate.data.temperature?.value,2);assert.equal(calls,2);
 assert.equal((await client.get(currentPath)).data.temperature?.value,2);assert.equal(calls,2);
 fail=true;now+=1000;
 const old=await client.get(currentPath,true);
 assert.equal(old.stale,true);assert.equal(old.fetchedAt,fresh.fetchedAt);assert.equal(old.data.temperature?.value,2);
});
test('GeoAPI只合并进行中的请求，不存储结果缓存',async()=>{
 let calls=0;const client=api.createClient(await testEnv(),async()=>{calls++;return Response.json({code:'200',location:[]});});
 await client.get('/geo/v2/city/lookup?location=beijing&number=20&lang=zh');await client.get('/geo/v2/city/lookup?location=beijing&number=20&lang=zh');assert.equal(calls,2);
});
test('单个预报产品无权限不阻断其他天气接口',async()=>{
 let calls=0;const client=api.createClient(await testEnv(),async input=>{calls++;return String(input).includes('/hourly/')?Response.json({error:{type:'forbidden'}},{status:403}):Response.json({temperature:{value:12,unit:'°C'}});});
 await assert.rejects(client.get('/weather/v1/hourly/39.92/116.42?localTime=true&lang=zh&hours=240'),{code:'FORBIDDEN'});
 assert.equal((await client.get(currentPath)).data.temperature?.value,12);assert.equal(calls,2);
});
test('限流暂停上游请求，错误响应不回显上游内容',async()=>{
 let calls=0;const client=api.createClient(await testEnv(),async()=>{calls++;return Response.json({error:{detail:'upstream private diagnostic'}},{status:429});});
 await assert.rejects(client.get(currentPath),{code:'RATE_LIMIT'});await assert.rejects(client.get(currentPath),{code:'RATE_LIMIT'});assert.equal(calls,1);
 const r=api.errorResponse(new Error('upstream private diagnostic'));assert.equal(r.status,500);assert.ok(!(await r.text()).includes('private diagnostic'));
 for(const [status,code,type] of [[401,'AUTH_FAILED',''],[403,'QUOTA_EXCEEDED','https://dev.qweather.com/docs/resource/error-code/#no-credit'],[403,'FORBIDDEN',''],[400,'NO_DATA','https://dev.qweather.com/docs/resource/error-code/#data-not-available']] as const){const cl=api.createClient(await testEnv(),async()=>Response.json({error:{type}},{status}));await assert.rejects(cl.get(currentPath),{code});}
});
test('无效JSON结构和新版无数据标记明确处理',async()=>{
 const invalid=api.createClient(await testEnv(),async()=>Response.json(null));await assert.rejects(invalid.get(currentPath),{code:'INVALID_RESPONSE'});
 const empty=api.createClient(await testEnv(),async()=>Response.json({metadata:{zeroResult:true}}));assert.equal((await empty.get('/weather/v1/daily/0.00/0.00?localTime=true&lang=zh&days=10')).data.metadata?.zeroResult,true);
});
test('每分钟限流在窗口结束后恢复',()=>{
 for(let i=0;i<60;i++)api.rateLimit('unit-test-rate-limit',100000);
 assert.throws(()=>api.rateLimit('unit-test-rate-limit',100001),{code:'RATE_LIMIT'});
 assert.doesNotThrow(()=>api.rateLimit('unit-test-rate-limit',160001));
});

test('历史接口转换每日数据并拒绝错日期，不影响预报权限',async()=>{
 const path='/v7/historical/weather?location=101010100&date=20261019&lang=zh&unit=m';
 const client=api.createClient(await testEnv(),async()=>Response.json({code:'200',weatherDaily:{date:'2026-10-19',tempMax:'18',tempMin:'5',humidity:'60',precip:'0',pressure:'1020'},refer:{sources:['QWeather'],license:[]}}));
 const result=await client.get(path);assert.equal(result.data.temperatureMax?.value,18);assert.equal(result.data.humidity,.6);assert.equal(result.data.date,'2026-10-19');
 await assert.rejects(client.get(path.replace('20261019','20261018')),{code:'INVALID_RESPONSE'});
 const forbidden=api.createClient(await testEnv(),async input=>String(input).includes('/historical/')?Response.json({code:'403'}):Response.json({temperature:{value:10,unit:'°C'}}));
 await assert.rejects(forbidden.get(path),{code:'FORBIDDEN'});
 assert.equal((await forbidden.get(currentPath)).data.temperature?.value,10);
});

test('逐小时刷新保留过去预报，跨范围复用且不污染未来列表或其他城市',async()=>{
 let now=Date.parse('2026-10-22T00:00:00+08:00'),batch=0;
 const point=(hour:number,value:number)=>({forecastTime:`2026-10-22T${String(hour).padStart(2,'0')}:00:00+08:00`,temperature:{value,unit:'°C'},precipitation:{probability:0}});
 const client=api.createClient(await testEnv(),async()=>Response.json({hours:batch===0?[point(0,0),point(1,2),point(15,9)]:[point(15,17),point(16,16)],metadata:{attributions:['QWeather']}}),()=>now);
 const path='/weather/v1/hourly/39.92/116.42?localTime=true&lang=zh&hours=240';
 const first=await client.get(path);assert.deepEqual(first.data.pastHours??[],[]);
 batch=1;now+=15*3600000;
 const result=await client.get(path.replace('hours=240','hours=24'));
 assert.deepEqual(result.data.hours?.map(h=>h.temperature?.value),[17,16]);
 assert.deepEqual(result.data.pastHours?.map(h=>h.temperature?.value),[0,2]);
 assert.equal(result.data.pastHours?.[0].precipitation?.probability,0);
 const other=await client.get(path.replace('39.92','31.23'));
 assert.deepEqual(other.data.pastHours??[],[]);
 now+=49*3600000;
 assert.deepEqual((await client.get(path,true)).data.pastHours??[],[]);
});

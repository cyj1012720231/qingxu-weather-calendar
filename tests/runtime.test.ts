import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherRuntime, resolveWeatherEnvironment } from '../lib/weather-runtime.ts';

async function credentials(){
 const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 return {QWEATHER_API_HOST:'sample.qweatherapi.com',QWEATHER_KID:'test-kid',QWEATHER_ISS:'test-issuer',QWEATHER_SUB:'test-project',QWEATHER_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----'};
}
const path='/weather/v1/current/39.92/116.41?localTime=true&lang=zh';

test('Node服务读取运行时环境变量、裁剪空白且只提取天气配置',()=>{
 const original=process.env.QWEATHER_KID;
 try{
  process.env.QWEATHER_KID='  runtime-kid  ';
  assert.equal(resolveWeatherEnvironment().QWEATHER_KID,'runtime-kid');
  assert.deepEqual(Object.keys(resolveWeatherEnvironment()).sort(),['QWEATHER_API_HOST','QWEATHER_ISS','QWEATHER_KID','QWEATHER_PRIVATE_KEY','QWEATHER_SUB']);
 }finally{if(original===undefined)delete process.env.QWEATHER_KID;else process.env.QWEATHER_KID=original;}
});

test('缺失配置不请求上游，运行中补齐或替换凭据后自动恢复',async()=>{
 let env={},calls=0;
 const runtime=createWeatherRuntime(()=>env,async()=>{calls++;return Response.json({temperature:{value:12}});});
 const missing=await runtime.check();
 assert.equal(missing.configured,false);assert.equal(missing.connection.code,'CONFIG_MISSING');assert.equal(calls,0);
 env=await credentials();assert.equal((await runtime.check()).connection.ok,true);
 env={...env,QWEATHER_KID:'rotated'};
 assert.equal((await runtime.check()).connection.ok,true);assert.equal(calls,2);
});

test('检查实际鉴权、合并重复点击，成功后清除旧鉴权失败冷却',async()=>{
 const env=await credentials();let fail=true,calls=0,now=1800000000000;
 const runtime=createWeatherRuntime(()=>env,async()=>{calls++;return fail?Response.json({privateDetail:'never expose'},{status:401}):Response.json({temperature:{value:12}});},()=>now);
 await assert.rejects(runtime.get(path),{code:'AUTH_FAILED'});
 const failed=await runtime.check();assert.equal(failed.configured,true);assert.equal(failed.connection.code,'AUTH_FAILED');
 assert.ok(!JSON.stringify(failed).includes('never expose'));assert.ok(!JSON.stringify(failed).includes('PRIVATE KEY'));
 fail=false;now+=15001;
 const [a,b]=await Promise.all([runtime.check(),runtime.check()]);assert.equal(a.connection.ok,true);assert.deepEqual(a,b);assert.equal(calls,3);
 assert.equal((await runtime.get(path)).data.temperature?.value,12);assert.equal(calls,3);
});

test('无效私钥显示可操作错误，不发出上游请求',async()=>{
 const env=await credentials();env.QWEATHER_PRIVATE_KEY='invalid';let calls=0;
 const runtime=createWeatherRuntime(()=>env,async()=>{calls++;return Response.json({});});
 const result=await runtime.check();assert.equal(result.connection.code,'CONFIG_INVALID');assert.equal(calls,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, Response as WorkerResponse } from 'miniflare';

test('真实Worker运行时支持天气请求，并拒绝携带JWT跟随重定向',async()=>{
 const key=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const env={QWEATHER_API_HOST:'sample.qweatherapi.com',QWEATHER_KID:'test',QWEATHER_ISS:'test',QWEATHER_SUB:'test',QWEATHER_PRIVATE_KEY:Buffer.from(await crypto.subtle.exportKey('pkcs8',key.privateKey)).toString('base64')};
 const bundled=await build({stdin:{contents:`import {createClient,errorResponse} from './lib/qweather-server.ts';export default {async fetch(request,env){try{return Response.json(await createClient(env).get('/weather/v1/current/39.92/116.41?localTime=true&lang=zh'));}catch(e){return errorResponse(e);}}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let redirect=false,calls=0;
 const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-15',script:bundled.outputFiles[0].text,bindings:env,outboundService:(request)=>{
  calls++;assert.equal(new URL(request.url).hostname,'sample.qweatherapi.com');assert.match(request.headers.get('Authorization')??'',/^Bearer /);
  return redirect?new WorkerResponse(null,{status:302,headers:{Location:'https://other.example'}}):new WorkerResponse(JSON.stringify({temperature:{value:12,unit:'°C'}}),{headers:{'Content-Type':'application/json'}});
 }});
 try{
  const success=await mf.dispatchFetch('https://test.local');assert.equal(success.status,200);assert.equal((await success.json() as any).data.temperature.value,12);
  redirect=true;const refused=await mf.dispatchFetch('https://test.local');assert.equal(refused.status,502);assert.equal((await refused.json() as any).error.code,'UPSTREAM_REDIRECT');assert.equal(calls,2);
 }finally{await mf.dispose();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createClient } from '../lib/qweather-server.ts';

test('Node原生fetch发送JWT并拒绝跟随上游重定向',async()=>{
 const key=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const env={QWEATHER_API_HOST:'sample.qweatherapi.com',QWEATHER_KID:'test',QWEATHER_ISS:'test',QWEATHER_SUB:'test',QWEATHER_PRIVATE_KEY:Buffer.from(await crypto.subtle.exportKey('pkcs8',key.privateKey)).toString('base64')};
 let redirect=false,calls=0,authorized=false;
 // 合成上游仅监听本机；仍使用 Node 原生 fetch 验证实际 HTTP 行为。
 const upstream=createServer((request,response)=>{
  calls++;authorized=/^Bearer /.test(request.headers.authorization??'');
  if(redirect){response.writeHead(302,{Location:'/unexpected'});response.end();}
  else {response.setHeader('Content-Type','application/json');response.end(JSON.stringify({temperature:{value:12,unit:'°C'}}));}
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const address=upstream.address();assert.ok(address&&typeof address==='object');
 const fetcher:typeof fetch=(_input,init)=>fetch(`http://127.0.0.1:${address.port}`,init);
 const path='/weather/v1/current/39.92/116.41?localTime=true&lang=zh';
 try{
  assert.equal((await createClient(env,fetcher).get(path)).data.temperature?.value,12);
  assert.equal(authorized,true);
  redirect=true;
  await assert.rejects(createClient(env,fetcher).get(path),{code:'UPSTREAM_REDIRECT'});
  assert.equal(calls,2);
 }finally{upstream.close();upstream.closeAllConnections();await once(upstream,'close');}
});

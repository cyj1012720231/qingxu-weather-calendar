import { isIP } from 'node:net';
import type { ApiResult, WeatherPoint } from './weather.ts';
import { weatherDateKind, normalizeHistory } from './date-weather.ts';
export type WeatherEnv={QWEATHER_API_HOST?:string;QWEATHER_KID?:string;QWEATHER_ISS?:string;QWEATHER_SUB?:string;QWEATHER_PRIVATE_KEY?:string};
export class ApiError extends Error {
 code:string;status:number;retryAfter?:number;
 constructor(code:string,message:string,status=400,retryAfter?:number){super(message);this.code=code;this.status=status;this.retryAfter=retryAfter;}
}
const invalid=()=>new ApiError('INVALID_REQUEST','请求参数无效，请重新选择地点或预报范围。');
function checkParams(p:URLSearchParams,allowed:string[]){for(const key of p.keys())if(!allowed.includes(key)||p.getAll(key).length!==1)throw invalid();}
function decimal(value:string|null,limit:number){if(value===null||! /^-?\d+(\.\d+)?$/.test(value))throw invalid();const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>limit)throw invalid();return n.toFixed(2);}
function integer(value:string|null,max:number,fallback:number){if(value===null)return fallback;if(!/^\d+$/.test(value))throw invalid();const n=Number(value);if(n<1||n>max)throw invalid();return n;}
/** 只构造官方固定天气路径，不接受目标 URL 或任意路径。 */
export function weatherPath(p:URLSearchParams,now=Date.now()){
 if(p.get('kind')==='history'){
  checkParams(p,['kind','location','date','tz']);
  const location=p.get('location')??'',date=p.get('date')??'',tz=p.get('tz')??'';
  if(!/^[A-Za-z0-9]{1,32}$/.test(location)||weatherDateKind(date,tz,new Date(now).toISOString())!=='history')throw invalid();
  return '/v7/historical/weather?'+new URLSearchParams({location,date:date.replaceAll('-',''),lang:'zh',unit:'m'});
 }
 const kind=p.get('kind');if(!['current','daily','hourly'].includes(kind??''))throw invalid();
 checkParams(p,['kind','lat','lon',...(kind==='daily'?['days']:kind==='hourly'?['hours']:[])]);
 const lat=decimal(p.get('lat'),90),lon=decimal(p.get('lon'),180);
 const query=new URLSearchParams({localTime:'true',lang:'zh'});
 if(kind==='daily')query.set('days',String(integer(p.get('days'),10,10)));
 if(kind==='hourly')query.set('hours',String(integer(p.get('hours'),240,24)));
 return `/weather/v1/${kind}/${lat}/${lon}?${query}`;
}
export function geoPath(p:URLSearchParams){
 checkParams(p,['q','adm']);const q=p.get('q')?.trim();const adm=p.get('adm')?.trim();
 if(!q||q.length>80||/[\x00-\x1f]/.test(q)|| (adm && adm.length>80))throw invalid();
 if(q.includes(',')){const pieces=q.split(',');if(pieces.length!==2)throw invalid();decimal(pieces[0],180);decimal(pieces[1],90);}
 const query=new URLSearchParams({location:q,number:'20',lang:'zh'});if(adm)query.set('adm',adm);
 return `/geo/v2/city/lookup?${query}`;
}
export function apiHost(host:string){
 const h=host.trim().replace(/^https:\/\//,'').replace(/\/$/,'');
 if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+qweatherapi\.com$/i.test(h))throw new ApiError('CONFIG_INVALID','天气服务地址配置无效。',503);
 return `https://${h}`;
}
export function configuration(env:WeatherEnv){
 const names:(keyof WeatherEnv)[]=['QWEATHER_API_HOST','QWEATHER_KID','QWEATHER_ISS','QWEATHER_SUB','QWEATHER_PRIVATE_KEY'];
 const missing=names.filter(key=>!env[key]?.trim());return {configured:missing.length===0,missing};
}
function base64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
/** 私钥仅在服务端导入，15分钟JWT预留30秒时钟偏差，不使用长期浏览器Token。 */
export async function signJwt(env:WeatherEnv,now=Date.now()){
 const pem=env.QWEATHER_PRIVATE_KEY?.replace(/\\n/g,'\n').replace(/-----[^-]+-----/g,'').replace(/\s/g,'')??'';
 try {
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'Ed25519'},false,['sign']);
  const encode=(v:unknown)=>base64url(new TextEncoder().encode(JSON.stringify(v)));
  const payload=encode({alg:'EdDSA',kid:env.QWEATHER_KID})+'.'+encode({iss:env.QWEATHER_ISS,sub:env.QWEATHER_SUB,iat:Math.floor(now/1000)-30,exp:Math.floor(now/1000)+900});
  const signature=await crypto.subtle.sign('Ed25519',key,new TextEncoder().encode(payload));
  return payload+'.'+base64url(new Uint8Array(signature));
 }catch{throw new ApiError('CONFIG_INVALID','天气签名配置无效，请检查服务端凭据。',503);}
}
function upstreamError(status:number,type=''){
 if(status===401)return new ApiError('AUTH_FAILED','天气服务鉴权失败，请检查服务端凭据。',502);
 if(status===429)return new ApiError('RATE_LIMIT','天气服务请求较多，请稍后再试。',429,60);
 if(status===402||/no-credit|overdue/.test(type))return new ApiError('QUOTA_EXCEEDED','天气服务可用额度不足，请联系网站管理员。',503);
 if(status===403)return new ApiError('FORBIDDEN','天气服务访问受限，请检查额度、权限及专属服务地址。',503);
 if(status===404||/data-not-available|no-such-location/.test(type))return new ApiError('NO_DATA','此位置暂时没有可用天气数据。',404);
 if(status===400)return new ApiError('INVALID_REQUEST','天气服务无法处理此位置或预报范围。',400);
 return new ApiError('UPSTREAM_ERROR','天气服务暂时不可用，请稍后重试。',502);
}
type Entry={result:ApiResult;expires:number;staleUntil:number};
/** 有界内存缓存及进行中请求合并；Node 进程重启后缓存自然清空。 */
export const runtimeFetch:typeof fetch=(input,init)=>fetch(input,init);
export function createClient(env:WeatherEnv,fetcher:typeof fetch=runtimeFetch,clock=Date.now){
 const cache=new Map<string,Entry>(),pending=new Map<string,Promise<ApiResult>>();
 let token='',tokenExpires=0,cooldown=0,cooldownError:ApiError|undefined;
 const restricted=new Map<string,{until:number;error:ApiError}>();
 async function load(path:string,old:Entry|undefined):Promise<ApiResult>{
  const now=clock();
  try{
   if(now<cooldown)throw cooldownError;
   const restriction=restricted.get(path);if(restriction&&now<restriction.until)throw restriction.error;
   if(!token||now>=tokenExpires){token=await signJwt(env,now);tokenExpires=now+840000;}
   // 手动拒绝所有重定向，防止 JWT 被转发到其他主机。
   const response=await fetcher(apiHost(env.QWEATHER_API_HOST!)+path,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(12000)});
   if(response.status>=300&&response.status<400)throw new ApiError('UPSTREAM_REDIRECT','天气服务返回了异常跳转，请检查专属 API Host。',502);
   const bodyText=await response.text();if(bodyText.length>2_000_000)throw new ApiError('INVALID_RESPONSE','天气数据响应异常。',502);
   let body:WeatherPoint & {code?:string;error?:{type?:string};location?:unknown[]};
   try{body=JSON.parse(bodyText);}catch{throw new ApiError('INVALID_RESPONSE','天气服务返回了无法读取的数据。',502);}
   if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError('INVALID_RESPONSE','天气服务返回了无效的数据。',502);
   if(!response.ok || (body.code && body.code!=='200')){
    const error=upstreamError(response.ok?Number(body.code):response.status,body.error?.type);
    if(error.code==='FORBIDDEN'){if(restricted.size>=256)restricted.delete(restricted.keys().next().value!);restricted.set(path,{until:now+300000,error});}
    if(['AUTH_FAILED','QUOTA_EXCEEDED','RATE_LIMIT'].includes(error.code)){cooldown=now+(error.code==='RATE_LIMIT'?60000:300000);cooldownError=error;}
    throw error;
   }
   if(path.startsWith('/weather/v1/daily/')&&!Array.isArray(body.days)&&!body.metadata?.zeroResult)throw new ApiError('INVALID_RESPONSE','每日预报格式异常。',502);
   if(path.startsWith('/weather/v1/hourly/')&&!Array.isArray(body.hours)&&!body.metadata?.zeroResult)throw new ApiError('INVALID_RESPONSE','小时预报格式异常。',502);
   if(path.startsWith('/geo/')&&!Array.isArray(body.location))throw new ApiError('NO_DATA','没有找到匹配的地点。',404);
   // 历史产品独立转换，不能让旧版字段影响当前天气和预报解析。
   let data:WeatherPoint=body;
   if(path.startsWith('/weather/v1/hourly/')&&body.hours?.length){
    // 预报刷新会丢掉过去小时；复用同坐标、各预报范围的真实旧预报，未来列表保持原样。
    const first=Math.min(...body.hours.map(hour=>Date.parse(hour.forecastTime??'')).filter(Number.isFinite));
    const past=new Map<number,WeatherPoint>(),sources=new Set(body.metadata?.attributions??[]);
    for(const [key,entry] of [...cache].sort((a,b)=>Date.parse(a[1].result.fetchedAt)-Date.parse(b[1].result.fetchedAt))){
     if(key.split('?')[0]!==path.split('?')[0])continue;
     for(const hour of [...entry.result.data.pastHours??[],...entry.result.data.hours??[]]){
      const time=Date.parse(hour.forecastTime??'');
      if(time>=now-48*3600000&&time<now&&time<first){past.set(time,hour);for(const source of entry.result.data.metadata?.attributions??[])sources.add(source);}
     }
    }
    data={...body,pastHours:[...past].sort((a,b)=>a[0]-b[0]).map(([,hour])=>hour),metadata:{...body.metadata,attributions:[...sources]}};
   }
   if(path.startsWith('/v7/historical/weather?')){
    try{data=normalizeHistory(body);if(data.date!==new URLSearchParams(path.split('?')[1]).get('date')?.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'))throw Error();}
    catch{throw new ApiError('INVALID_RESPONSE','历史天气响应日期或格式异常。',502);}
   }
   const result:ApiResult={data,fetchedAt:new Date(clock()).toISOString(),cached:false,stale:false};
   // GeoAPI仅合并并发查询，不建立响应缓存；行政目录来自官方独立CSV。
   if(path.startsWith('/geo/'))return result;
   const ttl=path.startsWith('/weather/v1/current/')?300000:1800000;
   if(cache.size>=256)cache.delete(cache.keys().next().value!);
   cache.set(path,{result,expires:clock()+ttl,staleUntil:clock()+21600000});
   return result;
  }catch(e){
   // 失败只回退同一地点、同一范围的真实缓存，并明确标记过期。
   if(!(e instanceof ApiError)){
    // 诊断日志过滤环境变量与 Token，避免网络异常带出服务端凭据。
    let diagnostic=e instanceof Error?`${e.name}: ${e.message}`:'Unknown upstream failure';
    for(const value of [...Object.values(env),token])if(value)diagnostic=diagnostic.split(value).join('[redacted]');
    diagnostic=diagnostic.replace(/https?:\/\/[^\s]+/g,'[upstream URL]');
    console.warn('Weather upstream request failed:',diagnostic.slice(0,300));
   }
   const error=e instanceof ApiError?e:new ApiError('NETWORK_ERROR','连接天气服务超时或失败，请稍后重试。',502);
   if(old&&old.staleUntil>clock())return {...old.result,cached:true,stale:true,warning:error.message};
   throw error;
  }
 }
 return {async get(path:string,refresh=false):Promise<ApiResult>{
  if(!configuration(env).configured)throw new ApiError('CONFIG_MISSING','天气服务尚未连接，请先完成服务端配置。',503);
  if(!/^\/(weather\/v1\/(current|daily|hourly)\/-?[\d.]+\/-?[\d.]+|geo\/v2\/city\/lookup|v7\/historical\/weather)\?/.test(path))throw invalid();
  // 手动刷新跳过有效缓存，但仍共用并发合并、错误冷却与失败回退。
  const entry=cache.get(path);if(!refresh&&entry&&entry.expires>clock())return {...entry.result,cached:true};
  if(pending.has(path))return pending.get(path)!;
  const promise=load(path,entry).finally(()=>pending.delete(path));pending.set(path,promise);return promise;
 }};
}
const requests=new Map<string,{count:number;reset:number}>();
/** 只有入口代理覆盖 X-Real-IP 且应用端口不对外开放时，才可开启 TRUST_PROXY。 */
export function requestRateLimitKey(headers:Headers,trustProxy=process.env.TRUST_PROXY==='true'){
 const ip=trustProxy?headers.get('x-real-ip')?.trim():undefined;
 return ip&&isIP(ip)?`ip:${ip}`:'shared';
}
export function rateLimit(key:string,now=Date.now()){
 let b=requests.get(key);if(!b||b.reset<=now){if(requests.size>=2000)requests.delete(requests.keys().next().value!);b={count:0,reset:now+60000};requests.set(key,b);}
 if(++b.count>60)throw new ApiError('RATE_LIMIT','操作太快了，请稍等一分钟再试。',429,60);
}
export function errorResponse(e:unknown){const error=e instanceof ApiError?e:new ApiError('SERVER_ERROR','天气服务暂时不可用。',500);return Response.json({error:{code:error.code,message:error.message}},{status:error.status,headers:{'Cache-Control':'no-store',...(error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});}

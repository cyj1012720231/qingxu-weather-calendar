import { validLocation, type Location, type ApiResult } from './weather.ts';
export class RequestError extends Error { code:string; constructor(message:string,code='NETWORK_ERROR'){super(message);this.code=code;} }
const cache=new Map<string,ApiResult>();
export async function request<T>(url:string,signal?:AbortSignal):Promise<T>{
 try{
  const response=await fetch(url,{signal});const body=await response.json() as T & {error?:{message?:string;code?:string};data?:unknown};
  if(!response.ok)throw new RequestError(body.error?.message??'请求失败，请稍后重试。',body.error?.code);
  if(url.startsWith('/api/weather?')&&body.data){if(cache.size>=30)cache.delete(cache.keys().next().value!);cache.set(url,body as unknown as ApiResult);}
  return body;
 }catch(e){
  if(signal?.aborted)throw e;
  const old=cache.get(url);
  if(old&&Date.now()-Date.parse(old.fetchedAt)<21600000)return {...old,stale:true,cached:true,warning:'网络连接失败，正在显示之前获取的数据。'} as T;
  throw e instanceof RequestError?e:new RequestError('连接失败，请检查网络后重试。');
 }
}
export function parseLocations(data:unknown):Location[]{
 if(!data||typeof data!=='object'||!('location' in data)||!Array.isArray(data.location))return [];
 return data.location.map((item:Record<string,unknown>)=>({id:item.id,name:item.name,adm1:item.adm1??'',adm2:item.adm2??'',country:item.country??'',lat:item.lat===''?NaN:Number(item.lat),lon:item.lon===''?NaN:Number(item.lon),tz:item.tz})).filter(validLocation);
}
export async function lookup(q:string,signal?:AbortSignal){const r=await request<ApiResult<unknown>>('/api/locations?'+new URLSearchParams({q}),signal);return parseLocations(r.data);}
export const weatherUrl=(loc:Location,kind:string,range?:number)=>'/api/weather?'+new URLSearchParams({kind,lat:String(loc.lat),lon:String(loc.lon),...(kind==='hourly'?{hours:String(range??24)}:kind==='daily'?{days:String(range??10)}:{})});
export function geolocationMessage(e:{code:number}){return e.code===1?'定位权限未开启。请在浏览器中允许定位，或搜索城市。':e.code===3?'定位超时。请稍后重试，或手动选择城市。':'暂时无法获取位置，请检查设备定位服务，或搜索城市。';}
export function getPosition():Promise<GeolocationPosition>{
 if(!window.isSecureContext)return Promise.reject(new Error('定位需要 HTTPS 安全连接，请使用网站的安全地址。'));
 if(!navigator.geolocation)return Promise.reject(new Error('当前浏览器不支持定位，请搜索或手动选择城市。'));
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,e=>reject(new Error(geolocationMessage(e))),{timeout:12000,maximumAge:300000,enableHighAccuracy:false}));
}

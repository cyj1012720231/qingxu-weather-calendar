import { AsyncLocalStorage } from 'node:async_hooks';
import { ApiError, createClient, configuration, runtimeFetch, type WeatherEnv } from './qweather-server.ts';

// Always use the environment supplied to this request, including after a
// deployment or credential update. Never put these values in a browser bundle.
const environments = new AsyncLocalStorage<WeatherEnv>();
export const withWeatherEnvironment = <T>(env:WeatherEnv, run:()=>T) => environments.run(env,run);
const keys = ['QWEATHER_API_HOST','QWEATHER_KID','QWEATHER_ISS','QWEATHER_SUB','QWEATHER_PRIVATE_KEY'] as const;
export function resolveWeatherEnvironment(fallback:WeatherEnv):WeatherEnv {
 const bound=environments.getStore()??fallback;
 return Object.fromEntries(keys.map(key=>[key,bound[key]?.trim()])) as WeatherEnv;
}

export function createWeatherRuntime(readEnv:()=>WeatherEnv,fetcher:typeof fetch=runtimeFetch,clock=Date.now){
 let previous:WeatherEnv|undefined,client:ReturnType<typeof createClient>|undefined;
 let probe:Promise<Awaited<ReturnType<typeof check>>>|undefined,probeAt=0;
 function current(){
  const env=readEnv();
  if(!previous||keys.some(key=>previous![key]!==env[key])){
   previous={...env};client=createClient(env,fetcher,clock);probe=undefined;
  }
  return {env,client:client!};
 }
 async function check(env:WeatherEnv){
  const config=configuration(env),checkedAt=new Date(clock()).toISOString();
  if(!config.configured)return {...config,connection:{ok:false,code:'CONFIG_MISSING',message:'服务端尚未读取到全部配置。请确认变量已保存，并重新部署网站后再检查。',checkedAt}};
  const fresh=createClient(env,fetcher,clock);
  try{
   // A fresh request verifies credentials and current-weather permissions;
   // neither an old weather cache nor an authentication cooldown can hide it.
   await fresh.get('/weather/v1/current/39.92/116.41?localTime=true&lang=zh');
   if(keys.every(key=>previous?.[key]===env[key]))client=fresh;
   return {...config,connection:{ok:true,code:'CONNECTED',message:'连接成功，已通过和风实时天气接口验证。',checkedAt}};
  }catch(error){
   return {...config,connection:{ok:false,code:error instanceof ApiError?error.code:'SERVER_ERROR',message:error instanceof ApiError?error.message:'无法检查天气连接，请稍后重试。',checkedAt}};
  }
 }
 return {
  configuration:()=>configuration(readEnv()),
  get:(path:string)=>current().client.get(path),
  check:()=>{const {env}=current();if(!probe||clock()-probeAt>=15000){probeAt=clock();probe=check({...env});}return probe;},
 };
}

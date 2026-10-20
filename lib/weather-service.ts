import { env } from 'cloudflare:workers';
import { type WeatherEnv } from './qweather-server';
import { createWeatherRuntime, resolveWeatherEnvironment } from './weather-runtime';
// Worker环境绑定不会被导入任何客户端组件。
export const weatherService=createWeatherRuntime(()=>resolveWeatherEnvironment(env as unknown as WeatherEnv));
export const weatherConfiguration=()=>weatherService.configuration();

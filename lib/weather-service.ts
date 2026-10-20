import { createWeatherRuntime, resolveWeatherEnvironment } from './weather-runtime';
// 仅由服务端 API 路由导入；密钥在容器启动后读取，不写入前端或构建配置。
export const weatherService=createWeatherRuntime(resolveWeatherEnvironment);
export const weatherConfiguration=()=>weatherService.configuration();

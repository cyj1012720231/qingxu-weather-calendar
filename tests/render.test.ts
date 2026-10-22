import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { defaultPreferences } from '../lib/weather.ts';

// 合成资料只在测试进程使用，绝不注入站点页面或作为真实天气展示。
const testDir=path.resolve('work/render-test');await mkdir(testDir,{recursive:true});
const output=await build({entryPoints:['components/weather-ui.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,jsx:'automatic'});
const file=path.join(testDir,'components.mjs');await writeFile(file,output.outputFiles[0].text);
const ui=await import(pathToFileURL(file).href);
const pageOutput=await build({entryPoints:['app/page.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,jsx:'automatic'});
const pageFile=path.join(testDir,'page.mjs');await writeFile(pageFile,pageOutput.outputFiles[0].text);
const {default:WeatherApp}=await import(pathToFileURL(pageFile).href);
const calendarOutput=await build({entryPoints:['components/calendar-view.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,jsx:'automatic'});
const calendarFile=path.join(testDir,'calendar.mjs');await writeFile(calendarFile,calendarOutput.outputFiles[0].text);
const {CalendarView}=await import(pathToFileURL(calendarFile).href);
const pullOutput=await build({entryPoints:['components/pull-to-refresh.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,jsx:'automatic'});
const pullFile=path.join(testDir,'pull.mjs');await writeFile(pullFile,pullOutput.outputFiles[0].text);
const {PullToRefresh}=await import(pathToFileURL(pullFile).href);
test('刷新提示保持稳定节点，空闲时隐藏，且不挤动页面内容',()=>{
 const html=renderToStaticMarkup(createElement(PullToRefresh,{onRefresh:()=>{},refreshing:false,disabled:false,className:'surface'},createElement('p',null,'原有内容')));
 assert.match(html,/<div[^>]+class="pull-refresh-indicator"[^>]+hidden=""/);
 assert.ok(html.includes('原有内容'));
 assert.ok(!html.includes('style="top:'));
});
test('首次打开停留在日历，仅提供前往天气的悬浮按钮',()=>{
 const html=renderToStaticMarkup(createElement(WeatherApp));
 assert.equal((html.match(/aria-label="切换到天气"/g)??[]).length,1);
 assert.ok(!html.includes('aria-label="切换到日历"'));
 assert.ok(!html.includes('aria-label="当前天气"'));
 assert.ok(!html.includes('<h1>详细天气</h1>'));
 assert.ok(!html.includes('数据与连接'));
});
test('首屏提供与手机日历底色一致的单一浏览器主题色',()=>{
 const html=renderToStaticMarkup(createElement(WeatherApp));
 assert.equal((html.match(/name="theme-color"/g)??[]).length,1);
 assert.match(html,/<meta name="theme-color" content="#4c7ea5"/);
});
test('正常天气不显示获取时间，过期数据仍明确提示缓存与失败原因',()=>{
 const result={data:{},fetchedAt:'2026-10-21T00:00:00Z',cached:false,stale:false};
 assert.equal(renderToStaticMarkup(createElement(ui.Freshness,{result,tz:'Asia/Shanghai'})),'');
 const stale=renderToStaticMarkup(createElement(ui.Freshness,{result:{...result,stale:true,warning:'网络连接失败'},tz:'Asia/Shanghai'}));
 assert.ok(stale.includes('缓存 · 非最新'));
 assert.ok(stale.includes('网络连接失败'));
});
test('年月选择使用可访问的组件触发器，并显示当前年月',()=>{
 const html=renderToStaticMarkup(createElement(CalendarView,{selected:'2026-10-31',now:'2026-10-20T00:00:00Z',place:null,onSelect:()=>{},onWeather:()=>{}}));
 assert.equal((html.match(/role="combobox"/g)??[]).length,2);
 for(const text of ['选择年份','选择月份','2026年','10月'])assert.ok(html.includes(text),text);
});
test('首屏不根据浏览器设备能力改变HTML，避免水合不一致',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{
  const render=(navigator:unknown)=>{Object.defineProperty(globalThis,'navigator',{value:navigator,configurable:true});return renderToStaticMarkup(createElement(WeatherApp));};
  const server=render(undefined);
  assert.equal(render({hardwareConcurrency:2,connection:{saveData:true}}),server);
  assert.equal(render({hardwareConcurrency:8}),server);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else Reflect.deleteProperty(globalThis,'navigator');}
});
const fixture={temperature:{value:0,unit:'°C'},humidity:0,wind:{speed:{value:10,unit:'m/s'},direction:{compass:'nw',degree:315},scale:3},cloudCover:.69,precipitation:{probability:.5,amount:{value:0,unit:'mm'}},condition:{code:'100',text:'测试样本'}};
test('完整字段中文渲染，0°C转32°F，比例与风速真实换算',()=>{
 const html=renderToStaticMarkup(createElement(ui.DataFields,{data:fixture,prefs:{...defaultPreferences,temperature:'F',wind:'km/h'},tz:'Asia/Shanghai'}));
 for(const expected of ['32°','0%','69%','50%','36 km/h','西北','相对湿度','降水概率'])assert.ok(html.includes(expected),expected);
 assert.ok(!html.includes('NaN'));
});
test('天气详情隐藏接口元信息，同时保留气象字段和来源链接',()=>{
 const data={...fixture,metadata:{tag:'test-internal-tag',attributions:['https://example.com/weather-source']}};
 const html=renderToStaticMarkup(createElement(ui.DataFields,{data,prefs:defaultPreferences,tz:'Asia/Shanghai'}));
 assert.ok(html.includes('测试样本'));assert.ok(html.includes('0%'));
 assert.ok(!html.includes('test-internal-tag'));assert.ok(!html.includes('https://example.com/weather-source'));
 const attribution=renderToStaticMarkup(createElement(ui.Attribution,{results:[{data,fetchedAt:'2026-10-21T00:00:00Z',cached:false,stale:false}]}));
 assert.ok(attribution.includes('href="https://example.com/weather-source"'));assert.ok(attribution.includes('和风天气'));
});
test('天气详情按时段和天文类别分块，跨日时间、昼夜与未知字段均保留',()=>{
 const data={forecastStartTime:'2026-10-21T16:00:00Z',forecastEndTime:'2026-10-22T16:00:00Z',astro:{sunrise:'2026-10-21T22:37:00Z',sunset:'2026-10-22T09:35:00Z',astronomicalDawn:'2026-10-21T21:09:00Z',civilDusk:'2026-10-22T10:02:00Z',moonrise:null,moonPhase:'waxing-gibbous',extraAstro:'天文附加值'},daytime:{temperature:{value:0,unit:'°C'},humidity:0},nighttime:{temperature:{value:-2,unit:'°C'}},extraWeather:'气象附加值'};
 const html=renderToStaticMarkup(createElement(ui.DataFields,{data,prefs:defaultPreferences,tz:'Asia/Shanghai'}));
 for(const title of ['日期与时段','日出与日落','晨光','暮光','月亮信息','白天','夜间'])assert.ok(html.includes(`aria-label="${title}"`),title);
 for(const value of ['2026-10-22','2026-10-23','06:37','17:35','05:09','18:02','盈凸月','0°C','-2°C','0%','天文附加值','气象附加值','—'])assert.ok(html.includes(value),value);
 assert.equal((html.match(/06:37/g)??[]).length,1);
});
test('单日天气省去日期分组和重复日期，跨日时刻保留相对提示',()=>{
 const data={date:'2026-10-22',forecastStartTime:'2026-10-21T16:00:00Z',forecastEndTime:'2026-10-22T16:00:00Z',temperatureMin:{value:0,unit:'°C'},astro:{sunrise:'2026-10-21T22:37:00Z',moonrise:'2026-10-22T17:15:00Z',moonset:'2026-10-21T15:30:00Z',solarNoon:null},nighttime:{forecastStartTime:'2026-10-22T10:00:00Z',temperature:{value:-2,unit:'°C'}}};
 const html=renderToStaticMarkup(createElement(ui.DataFields,{data,prefs:defaultPreferences,tz:'Asia/Shanghai',date:'2026-10-22'}));
 const text=html.replace(/<[^>]*>/g,'');
 for(const removed of ['日期与时段','时段开始','时段结束','2026-10-21','2026-10-22','2026-10-23'])assert.ok(!text.includes(removed),removed);
 for(const retained of ['06:37','次日','01:15','前日','23:30','0°C','-2°C','夜间','—'])assert.ok(text.includes(retained),retained);
 assert.ok(html.includes('aria-label="2026-10-23 01:15"'));
 assert.ok(html.includes('dateTime="2026-10-22T17:15:00Z"'));
});
test('小时列表完整渲染24个时段，缺失值不生成假温度',()=>{
 const hours=Array.from({length:24},(_,i)=>({...fixture,forecastTime:new Date(Date.UTC(2026,9,20,i)).toISOString()}));
 const html=renderToStaticMarkup(createElement(ui.Hourly,{data:hours,prefs:defaultPreferences,tz:'Asia/Shanghai',days:[],onDetails:()=>{}}));
 assert.equal((html.match(/class="hour-item"/g)??[]).length,24);assert.ok(html.includes('08:00'));assert.ok(html.includes('50%'));
 const empty=renderToStaticMarkup(createElement(ui.DataFields,{data:{temperature:null,humidity:null},prefs:defaultPreferences,tz:'Asia/Shanghai'}));assert.ok(empty.includes('—'));assert.ok(!empty.includes('0°'));
});
test('10日与240小时图表接受完整范围，缺失温度不生成NaN路径',()=>{
 const days=Array.from({length:10},(_,i)=>({forecastStartTime:new Date(Date.UTC(2026,9,20+i)).toISOString(),temperatureMin:{value:i,unit:'°C'},temperatureMax:{value:i+10,unit:'°C'},daytime:fixture}));
 const d=renderToStaticMarkup(createElement(ui.Daily,{data:days,prefs:defaultPreferences,tz:'Asia/Shanghai',onDetails:()=>{}}));assert.equal((d.match(/class="day-row"/g)??[]).length,10);
 const chart=renderToStaticMarkup(createElement(ui.DailyChart,{days,prefs:defaultPreferences,tz:'Asia/Shanghai'}));assert.equal((chart.match(/role="button"/g)??[]).length,10);assert.ok(!chart.includes('NaN'));
 const hours=Array.from({length:240},(_,i)=>({...fixture,forecastTime:new Date(Date.UTC(2026,9,20,i)).toISOString()}));
 const h=renderToStaticMarkup(createElement(ui.WeatherChart,{hours,prefs:defaultPreferences,tz:'Asia/Shanghai'}));assert.equal((h.match(/role="button"/g)??[]).length,240);assert.ok(!h.includes('NaN'));
});

test('历史站点气压不会误标海平面气压，日期显示中文字段名',async()=>{
 const {normalizeHistory}=await import('../lib/date-weather.ts');
 const data=normalizeHistory({weatherDaily:{date:'2026-10-19',pressure:'700'}});
 const html=renderToStaticMarkup(createElement(ui.DataFields,{data,prefs:defaultPreferences,tz:'Asia/Shanghai'}));
 assert.ok(html.includes('站点气压'));assert.ok(html.includes('700 hPa'));assert.ok(!html.includes('海平面气压'));assert.ok(!html.includes('其他指标（date）'));
});

test('详情将昼夜温度与降水放在风和天文之前，不受接口字段顺序影响',()=>{
 const data={astro:{sunrise:'2026-10-22T06:37:00+08:00'},wind:{scale:3},nighttime:{precipitation:{probability:.7},temperature:{value:6,unit:'°C'}},daytime:{precipitation:{probability:.2},temperature:{value:15,unit:'°C'}},forecastStartTime:'2026-10-22T00:00:00+08:00',temperatureMin:{value:6,unit:'°C'}};
 const html=renderToStaticMarkup(createElement(ui.DataFields,{data,prefs:defaultPreferences,tz:'Asia/Shanghai'}));
 assert.ok(html.indexOf('日期与时段')<html.indexOf('天气与温度'));
 assert.ok(html.indexOf('6°C')<html.indexOf('70%'));
 assert.ok(html.indexOf('70%')<html.indexOf('aria-label="风"'));
 assert.ok(html.indexOf('aria-label="风"')<html.indexOf('日出与日落'));
});

test('单日趋势固定全天坐标并保留零降水，缺失小时不补曲线',()=>{
 const hours=[{forecastTime:'2026-10-22T00:00:00+08:00',temperature:{value:0,unit:'°C'},precipitation:{probability:0}},{forecastTime:'2026-10-22T01:00:00+08:00'},{forecastTime:'2026-10-22T06:00:00+08:00',temperature:{value:10,unit:'°C'},precipitation:{probability:.4}}];
 const html=renderToStaticMarkup(createElement(ui.ForecastTrends,{hours,prefs:defaultPreferences,tz:'Asia/Shanghai',date:'2026-10-22'}));
 assert.ok(html.indexOf('气温趋势')<html.indexOf('降水概率'));
 for(const text of ['0时','6时','12时','18时','24时','0%','40%'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'));
 const lines=[...html.matchAll(/<path d="([^"]*)" stroke="#f1dc9c"/g)];
 assert.equal(lines.length,2,'缺失的小时不能被连接成一段连续曲线');
 const empty=renderToStaticMarkup(createElement(ui.ForecastTrends,{hours:[],prefs:defaultPreferences,tz:'Asia/Shanghai',date:'2026-10-22'}));
 assert.ok(empty.includes('暂无逐小时'));assert.ok(!empty.includes('0%'));
});

test('逐小时详情在降水之后保留风速，日降水区分零概率和缺失',()=>{
 const html=renderToStaticMarkup(createElement(ui.ForecastTrends,{hours:[{...fixture,forecastTime:'2026-10-22T00:00:00+08:00'}],prefs:defaultPreferences,tz:'Asia/Shanghai'}));
 assert.ok(html.indexOf('气温趋势')<html.indexOf('降水概率'));
 assert.ok(html.indexOf('降水概率')<html.indexOf('风速趋势'));
 assert.ok(html.includes('36 km/h'));
 const rain=renderToStaticMarkup(createElement(ui.DailyRainChart,{days:[{forecastStartTime:'2026-10-22T00:00:00+08:00',daytime:{precipitation:{probability:0}}}],tz:'Asia/Shanghai'}));
 for(const text of ['白天','夜间','0%','—'])assert.ok(rain.includes(text),text);
});

test('早间预报与最新预报都可点击查看温度和概率，并说明旧预报来源',()=>{
 const hours=[{forecastTime:'2026-10-22T00:00:00+08:00',temperature:{value:0,unit:'°C'},precipitation:{probability:0}},{forecastTime:'2026-10-22T15:00:00+08:00',temperature:{value:17,unit:'°C'},precipitation:{probability:.4}}];
 const html=renderToStaticMarkup(createElement(ui.ForecastTrends,{hours,prefs:defaultPreferences,tz:'Asia/Shanghai',date:'2026-10-22',pastNote:'过去时段为此前预报，非历史实况。'}));
 for(const text of ['00:00 实际气温 0°','15:00 实际气温 17°','00:00 降水概率 0%','15:00 降水概率 40%','过去时段为此前预报'])assert.ok(html.includes(text),text);
});

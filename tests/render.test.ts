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

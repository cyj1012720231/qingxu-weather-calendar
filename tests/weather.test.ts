import test from 'node:test';
import assert from 'node:assert/strict';
import * as weather from '../lib/weather.ts';

// 这些断言针对真实数据边界；测试数值仅存在于测试文件，不作为产品天气。
test('温度与风速转换保留真实单位且拒绝缺失值', () => {
  assert.equal(weather.temperature({value:0,unit:'°C'},'F'),32);
  assert.equal(weather.temperature({value:68,unit:'°F'},'C'),20);
  assert.equal(weather.speed({value:10,unit:'m/s'},'km/h'),36);
  assert.equal(weather.speed({value:36,unit:'km/h'},'m/s'),10);
  assert.equal(weather.temperature({value:null,unit:'°C'},'C'),null);
  assert.equal(weather.temperature({value:12,unit:'unknown'},'C'),null);
  assert.equal(weather.percent(0), '0%');
  assert.equal(weather.percent(.69),'69%');
  assert.equal(weather.percent(undefined),'—');
  assert.equal(weather.percent(69),'—');
});
test('城市本地日期跨UTC日界线和夏令时显示正确',()=>{
 assert.equal(weather.localDate('2026-10-19T18:00:00Z','Asia/Shanghai'),'2026-10-20');
 assert.equal(weather.localTime('2026-07-20T16:00:00Z','America/New_York'),'12:00');
 assert.equal(weather.localTime('2026-01-20T16:00:00Z','America/New_York'),'11:00');
 assert.equal(weather.localTime(undefined,'Asia/Shanghai'),'—');
});
test('昼夜优先用日出日落，缺资料则保持未知而非伪造',()=>{
 const day={astro:{sunrise:'2026-10-20T06:00:00+08:00',sunset:'2026-10-20T18:00:00+08:00'}};
 assert.equal(weather.isNight(day,'2026-10-20T05:59:00+08:00'),true);
 assert.equal(weather.isNight(day,'2026-10-20T12:00:00+08:00'),false);
 assert.equal(weather.isNight(day,'2026-10-20T18:00:00+08:00'),true);
 assert.equal(weather.isNight(undefined,'2026-10-20T12:00:00Z'),null);
 assert.equal(weather.weatherKind('302'),'storm');
 assert.equal(weather.weatherKind('404'),'snow');
 assert.equal(weather.weatherKind('999'),'unknown');
});
test('温度区间按全体真实范围计算，零宽和缺失安全处理',()=>{
 assert.deepEqual(weather.temperatureRange(10,20,0,40),{left:25,width:25});
 assert.deepEqual(weather.temperatureRange(0,0,0,0),{left:0,width:100});
 assert.equal(weather.temperatureRange(null,20,0,40),null);
});
test('同名区县保留完整上级地区，不给官方名称补区县后缀',()=>{
 assert.equal(weather.locationLabel({name:'长安',adm1:'河北省',adm2:'石家庄',country:'中国'}),'河北省 · 石家庄 · 长安');
 assert.equal(weather.locationLabel({name:'北京',adm1:'北京市',adm2:'北京',country:'中国'}),'北京市 · 北京');
});

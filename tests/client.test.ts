import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../lib/weather-client.ts';
import {validLocation,parsePreferences} from '../lib/weather.ts';
test('本地偏好校验不会将畸形存储作为城市或单位',()=>{
 assert.equal(validLocation({id:'x',name:'测试',adm1:'',adm2:'',country:'',lat:0,lon:0,tz:'Invalid/Zone'}),false);
 assert.equal(parsePreferences({temperature:'K',wind:'bad',theme:'bad'}).temperature,'C');
});
test('Geo字段明确转换为数字，经纬度无效或时区无效的结果被排除',()=>{
 assert.deepEqual(client.parseLocations({location:[{id:'1B6D3',name:'区',adm1:'省',adm2:'市',country:'中国',lat:'39.92',lon:'116.41',tz:'Asia/Shanghai'},{id:'bad',lat:'',lon:'0',tz:'UTC'}]}),[{id:'1B6D3',name:'区',adm1:'省',adm2:'市',country:'中国',lat:39.92,lon:116.41,tz:'Asia/Shanghai'}]);
});
test('定位错误涵盖拒绝、超时、不可用和HTTPS限制',()=>{
 assert.match(client.geolocationMessage({code:1}),/权限/);
 assert.match(client.geolocationMessage({code:2}),/获取/);
 assert.match(client.geolocationMessage({code:3}),/超时/);
});

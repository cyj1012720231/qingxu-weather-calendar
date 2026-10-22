import test from 'node:test';
import assert from 'node:assert/strict';
import {createLongPress,createPullGesture,createDateSwipe} from '../lib/gestures.ts';

test('短按和移动不触发长按，长按只触发一次并吞掉紧随的点击',context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 let calls=0;const press=createLongPress();
 press.start(10,20,()=>calls++);context.mock.timers.tick(100);press.end();context.mock.timers.tick(500);assert.equal(calls,0);
 press.start(10,20,()=>calls++);press.move(10,45);context.mock.timers.tick(600);assert.equal(calls,0);
 press.start(10,20,()=>calls++);context.mock.timers.tick(600);press.end();context.mock.timers.tick(1000);
 assert.equal(calls,1);assert.equal(press.consumeClick(),true);assert.equal(press.consumeClick(),false);
 press.start(10,20,()=>calls++);press.cancel();context.mock.timers.tick(600);assert.equal(calls,1);
});

test('日期横滑仅在明确横向移动后切换，纵向滚动和取消不会翻日',()=>{
 const swipe=createDateSwipe();
 swipe.start(100,100);swipe.move(30,105);assert.equal(swipe.release(),1);
 swipe.start(100,100);swipe.move(180,103);assert.equal(swipe.release(),-1);
 swipe.start(100,100);swipe.move(120,104);assert.equal(swipe.release(),0);
 swipe.start(100,100);swipe.move(105,130);swipe.move(10,132);assert.equal(swipe.release(),0);
 swipe.start(100,100);swipe.move(10,102);swipe.cancel();assert.equal(swipe.release(),0);
 assert.equal(swipe.release(),0);
});

test('下拉松手达到阈值才刷新，横滑、上滑和取消不能误触发',()=>{
 const pull=createPullGesture();
 pull.start(20,30);assert.equal(pull.move(22,100),35);assert.equal(pull.release(),false);
 pull.start(20,30);assert.equal(pull.move(22,190),80);assert.equal(pull.release(),true);assert.equal(pull.release(),false);
 pull.start(20,30);assert.equal(pull.move(100,60),null);assert.equal(pull.move(20,190),null);assert.equal(pull.release(),false);
 pull.start(20,30);assert.equal(pull.move(25,31),0);assert.equal(pull.move(70,33),null);assert.equal(pull.release(),false);
 pull.start(20,30);assert.equal(pull.move(20,10),null);assert.equal(pull.release(),false);
 pull.start(20,30);pull.move(20,190);pull.cancel();assert.equal(pull.release(),false);
 pull.start(20,30);pull.move(20,190);pull.move(20,32);assert.equal(pull.release(),false);
});

'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowDown,RefreshCw} from 'lucide-react';
import {createPullGesture} from '../lib/gestures';

/** 仅接管页面顶部的单指下拉；固定提示层不挤动已有内容。 */
export function PullToRefresh({children,onRefresh,refreshing,disabled,className}:{children:ReactNode;onRefresh:()=>void;refreshing:boolean;disabled:boolean;className:string}){
 const surface=useRef<HTMLDivElement>(null),[distance,setDistance]=useState(0),[active,setActive]=useState(false);
 const [previousRefreshing,setPreviousRefreshing]=useState(refreshing);
 if(previousRefreshing!==refreshing){setPreviousRefreshing(refreshing);if(!refreshing)setActive(false);}
 useEffect(()=>{
  const element=surface.current;if(!element)return;
  const gesture=createPullGesture();
  const cancel=()=>{gesture.cancel();setDistance(0);};
  const start=(event:TouchEvent)=>{
   cancel();if(disabled||refreshing||event.touches.length!==1||window.scrollY>0)return;
   const target=event.target instanceof Element?event.target:null;
   if(target?.closest('input,textarea,select,[contenteditable="true"],[role="slider"],[role="combobox"]'))return;
   // 内层滚动区保留自己的手势，不能误触发整页刷新。
   for(let parent=target;parent&&parent!==element;parent=parent.parentElement){
    if(parent.scrollHeight>parent.clientHeight&&/(auto|scroll)/.test(getComputedStyle(parent).overflowY))return;
   }
   gesture.start(event.touches[0].clientX,event.touches[0].clientY);
  };
  const move=(event:TouchEvent)=>{
   if(event.touches.length!==1||window.scrollY>0){cancel();return;}
   const next=gesture.move(event.touches[0].clientX,event.touches[0].clientY);
   if(next===null){setDistance(0);return;}
   if(next>0){if(!event.cancelable){cancel();return;}event.preventDefault();}
   setDistance(next);
  };
  const end=()=>{const ready=gesture.release();setDistance(0);if(ready&&!disabled&&!refreshing){setActive(true);onRefresh();}};
  element.addEventListener('touchstart',start,{passive:true});
  element.addEventListener('touchmove',move,{passive:false});
  element.addEventListener('touchend',end);element.addEventListener('touchcancel',cancel);
  return()=>{gesture.cancel();element.removeEventListener('touchstart',start);element.removeEventListener('touchmove',move);element.removeEventListener('touchend',end);element.removeEventListener('touchcancel',cancel);};
 },[disabled,onRefresh,refreshing]);
 return <div ref={surface} className={className}>
  {(distance>0||(active&&refreshing))&&<div className="pull-refresh-indicator" role="status" style={{top:`max(env(safe-area-inset-top), ${refreshing?18:Math.max(8,distance-24)}px)`}}>
   {refreshing?<RefreshCw size={18} className="refresh-spinning"/>:<ArrowDown size={18} style={{transform:distance>=64?'rotate(180deg)':undefined}}/>}
   <span>{refreshing?'正在刷新':distance>=64?'松开刷新':'下拉刷新'}</span>
  </div>}
  {children}
 </div>;
}

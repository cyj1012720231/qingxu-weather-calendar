/** 移动即取消长按，防止滚动月历时误打开日期操作。 */
export function createLongPress(){
 let timer:ReturnType<typeof setTimeout>|undefined,startX=0,startY=0,held=false;
 const end=()=>{clearTimeout(timer);timer=undefined;};
 const cancel=()=>{end();held=false;};
 return {
  start(x:number,y:number,open:()=>void){cancel();startX=x;startY=y;timer=setTimeout(()=>{timer=undefined;held=true;open();},500);},
  move(x:number,y:number){if(Math.hypot(x-startX,y-startY)>10)cancel();},
  end,cancel,
  consumeClick(){const consumed=held;held=false;return consumed;},
 };
}

/** 用阻尼距离判断刷新阈值；横向滑动和反向滚动一旦取消，不在同一手势中重新接管。 */
export function createPullGesture(){
 let start:{x:number;y:number}|null=null,distance=0;
 const cancel=()=>{start=null;distance=0;};
 return {
  start(x:number,y:number){start={x,y};distance=0;},
  move(x:number,y:number){
   if(!start)return null;
   const dx=Math.abs(x-start.x),dy=y-start.y;
   if(dy<0||(dx>=8&&dx>dy)){cancel();return null;}
   if(dx<8&&dy<8){distance=0;return 0;}
   distance=Math.min(96,dy*.5);return distance;
  },
  release(){const refresh=distance>=64;cancel();return refresh;},
  cancel,
 };
}

/** 横滑翻日只接管明确的水平手势；一旦开始纵向滚动，本次手势不再翻日。 */
export function createDateSwipe(){
 let start:{x:number;y:number}|null=null,dx=0,dy=0;
 const cancel=()=>{start=null;dx=0;dy=0;};
 return {
  start(x:number,y:number){start={x,y};dx=0;dy=0;},
  move(x:number,y:number){if(!start)return;dx=x-start.x;dy=y-start.y;if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx))cancel();},
  release(){const direction=start&&Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.5?(dx<0?1:-1):0;cancel();return direction;},
  cancel,
 };
}

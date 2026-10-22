export type Measure = { value?: number | null; unit?: string };
export type Location = { id: string; name: string; adm1: string; adm2: string; country: string; lat: number; lon: number; tz: string; located?: boolean };
export type Preferences = { temperature: 'C'|'F'; wind: 'km/h'|'m/s'|'mph'; animation: boolean; autoLocate: boolean; theme: 'auto'|'light'|'dark' };
export type WeatherPoint = {
  condition?: { code?: string; text?: string }; temperature?: Measure; feelsLike?: Measure;
  humidity?: number; wind?: { direction?: {degree?: number;compass?: string};speed?: Measure;scale?: number };
  windGust?: Measure; windGustMax?: Measure; precipitation?: { amount?: Measure; intensity?: Measure; probability?: number; type?: string };
  pressure?: Measure; visibility?: Measure; dewPoint?: Measure; cloudCover?: number; uvIndex?: number;
  forecastTime?: string; forecastStartTime?: string; forecastEndTime?: string;
  temperatureMax?: Measure; temperatureMin?: Measure; temperatureAvg?: Measure; uvIndexMax?: number;
  astro?: Record<string,string>; daytime?: WeatherPoint; nighttime?: WeatherPoint;
  metadata?: { tag?: string; attributions?: string[]; zeroResult?: boolean; [key:string]:unknown };
  days?: WeatherPoint[]; hours?: WeatherPoint[]; pastHours?: WeatherPoint[]; [key:string]:unknown;
};
export type ApiResult<T = WeatherPoint> = { data:T; fetchedAt:string; cached:boolean; stale:boolean; warning?:string };
export const defaultPreferences: Preferences = {temperature:'C',wind:'km/h',animation:true,autoLocate:false,theme:'auto'};
export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** 新版 API 携带单位；不能把缺失值或未知单位静默当成摄氏温度。 */
export function temperature(m: Measure | undefined, unit: 'C'|'F'): number|null {
  if(!m || !finite(m.value)) return null;
  const c = m.unit === '°C' ? m.value : m.unit === '°F' ? (m.value-32)*5/9 : m.unit === 'K' ? m.value-273.15 : null;
  return c === null ? null : unit === 'F' ? c*9/5+32 : c;
}
export function speed(m:Measure|undefined, unit:Preferences['wind']):number|null {
  if(!m || !finite(m.value)) return null;
  const factors:Record<string,number>={'m/s':1,'km/h':1/3.6,'mph':.44704,'kn':.514444};
  return factors[m.unit??''] === undefined ? null : m.value*factors[m.unit!]/factors[unit];
}
export const percent = (v:unknown) => finite(v)&&v>=0&&v<=1 ? `${Math.round(v*100)}%` : '—';
export const numberText = (v:unknown,digits=0) => finite(v) ? new Intl.NumberFormat('zh-CN',{maximumFractionDigits:digits}).format(v) : '—';
export const tempText = (m:Measure|undefined,p:Preferences) => {const n=temperature(m,p.temperature);return n===null?'—':`${Math.round(n)}°`;};
export const measureText = (m:Measure|undefined) => m && finite(m.value) ? `${numberText(m.value,1)} ${m.unit??''}` : '—';
export const windText = (m:Measure|undefined,p:Preferences) => {const n=speed(m,p.wind);return n===null?'—':`${numberText(n,1)} ${p.wind}`;};
export function visibilityText(m:Measure|undefined){return m?.unit==='m'&&finite(m.value)?`${numberText(m.value/1000,1)} km`:measureText(m);}

// 所有时间以地点时区格式化；无效时区和时间不回落到访客电脑时区。
export function localDate(value:string|undefined,tz:string):string {
  if(!value || !Number.isFinite(Date.parse(value)))return '—';
  try {return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}catch{return '—';}
}
export function localTime(value:string|undefined,tz:string):string {
  if(!value || !Number.isFinite(Date.parse(value)))return '—';
  try{return new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));}catch{return '—';}
}
export function dayLabel(value:string|undefined,tz:string,now=new Date().toISOString()) {
  const date=localDate(value,tz); if(date==='—')return '日期未知';
  if(date===localDate(now,tz))return '今天';
  try{return new Intl.DateTimeFormat('zh-CN',{timeZone:tz,weekday:'short'}).format(new Date(value!));}catch{return date;}
}
export function isNight(day:WeatherPoint|undefined,at:string):boolean|null {
  const rise=Date.parse(day?.astro?.sunrise??''),set=Date.parse(day?.astro?.sunset??''),now=Date.parse(at);
  if(![rise,set,now].every(Number.isFinite)||set<=rise)return null;
  return now<rise||now>=set;
}
export function weatherKind(code:unknown) {
  const n=Number(code);
  if(n===100)return 'clear'; if([101,102,103].includes(n))return 'cloudy';if(n===104)return 'overcast';
  if([302,303,304].includes(n))return 'storm';if(n>=300&&n<=399)return 'rain';if(n>=400&&n<=499)return 'snow';
  if(n>=500&&n<=515)return 'fog';return 'unknown';
}
export function temperatureRange(low:number|null,high:number|null,min:number,max:number) {
  if(!finite(low)||!finite(high)||!finite(min)||!finite(max)||high<low)return null;
  if(max===min)return {left:0,width:100};
  return {left:Math.max(0,(low-min)/(max-min)*100),width:Math.max(0,(high-low)/(max-min)*100)};
}
export function locationLabel(loc:Pick<Location,'name'|'adm1'|'adm2'|'country'>) {
  return [...new Set([loc.country!=='中国'?loc.country:'',loc.adm1,loc.adm2,loc.name].filter(Boolean))].join(' · ');
}
export const compassNames:Record<string,string>={n:'北',nne:'北东北',ne:'东北',ene:'东东北',e:'东',ese:'东东南',se:'东南',sse:'南东南',s:'南',ssw:'南西南',sw:'西南',wsw:'西西南',w:'西',wnw:'西西北',nw:'西北',nnw:'北西北',none:'静风',vrb:'风向不定'};
export const moonNames:Record<string,string>={'new-moon':'新月','waxing-crescent':'蛾眉月','first-quarter':'上弦月','waxing-gibbous':'盈凸月','full-moon':'满月','waning-gibbous':'亏凸月','last-quarter':'下弦月','waning-crescent':'残月'};
export const fieldNames:Record<string,string>={metadata:'数据来源与元信息',tag:'数据标识',attributions:'数据归属声明',zeroResult:'无数据标记',condition:'天气现象',text:'天气描述',code:'天气代码',temperature:'温度',feelsLike:'体感温度',humidity:'相对湿度',wind:'风',direction:'风向',degree:'角度',compass:'方向',speed:'风速',scale:'蒲福风级',windGust:'阵风',windGustMax:'最大阵风',precipitation:'降水',amount:'降水量',intensity:'降水强度',probability:'降水概率',type:'降水类型',date:'日期',stationPressure:'站点气压',pressure:'海平面气压',visibility:'能见度',dewPoint:'露点温度',cloudCover:'云量',uvIndex:'紫外线指数',uvIndexMax:'最大紫外线指数',forecastTime:'预报时间',forecastStartTime:'时段开始',forecastEndTime:'时段结束',temperatureMax:'最高温度',temperatureMin:'最低温度',temperatureAvg:'平均温度',astro:'天文',sunrise:'日出',sunset:'日落',astronomicalDawn:'天文晨光',nauticalDawn:'航海晨光',civilDawn:'民用晨光',astronomicalDusk:'天文暮光',nauticalDusk:'航海暮光',civilDusk:'民用暮光',solarNoon:'太阳中天',solarMidnight:'太阳下中天',moonrise:'月升',moonset:'月落',moonTransit:'月亮中天',moonUnderfoot:'月亮下中天',moonPhase:'月相',daytime:'白天',nighttime:'夜间',value:'数值',unit:'单位',days:'每日预报',hours:'逐小时预报'};

/** 本地存储同样是不可信输入，只接受完整坐标与可用时区。 */
export function validLocation(v:unknown):v is Location {
 if(!v||typeof v!=='object')return false;const l=v as Location;
 if(!['id','name','adm1','adm2','country','tz'].every(k=>typeof l[k as keyof Location]==='string')||!finite(l.lat)||!finite(l.lon)||Math.abs(l.lat)>90||Math.abs(l.lon)>180)return false;
 try{new Intl.DateTimeFormat('zh',{timeZone:l.tz});return !!l.name;}catch{return false;}
}
export function parsePreferences(v:unknown):Preferences {
 const p=(v&&typeof v==='object'?v:{}) as Partial<Preferences>;
 return {temperature:p.temperature==='F'?'F':'C',wind:['km/h','m/s','mph'].includes(p.wind??'')?p.wind!:'km/h',theme:['auto','light','dark'].includes(p.theme??'')?p.theme!:'auto',animation:p.animation!==false,autoLocate:p.autoLocate===true};
}

'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** 统一天气应用的下拉控件，复用 Radix 的键盘导航、滚动和焦点管理。 */
export function WeatherSelect({label,value,onChange,options,placeholder,disabled=false}: {
 label:string;
 value:string;
 onChange:(value:string)=>void;
 options:{value:string;label:string}[];
 placeholder?:string;
 disabled?:boolean;
}) {
 // Radix 不允许空值选项；保留地区选择原有的清空行为，再交回业务层空字符串。
 const clearValue='__clear_selection__';
 return <Select value={value} onValueChange={next=>onChange(next===clearValue?'':next)} disabled={disabled}>
  <SelectTrigger className="weather-select" aria-label={label}>
   <SelectValue placeholder={placeholder}>{options.find(option=>option.value===value)?.label}</SelectValue>
  </SelectTrigger>
  <SelectContent className="weather-select-menu" position="popper" align="start" sideOffset={5} collisionPadding={12}>
   {placeholder&&<SelectItem value={clearValue} className="weather-select-placeholder">{placeholder}</SelectItem>}
   {options.map(option=><SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
  </SelectContent>
 </Select>;
}

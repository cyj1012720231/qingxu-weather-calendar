import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'晴序 · 天气与日历',description:'简洁而细腻的天气体验。中国日历、农历节气、日期天气查询、逐小时趋势与10日预报，天气服务由和风天气驱动。',icons:{icon:'/favicon.svg'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#244e78'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}

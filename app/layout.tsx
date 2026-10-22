import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '../components/ui/sonner';
export const metadata:Metadata={title:'晴序 · 天气与日历',description:'简洁而细腻的天气体验。中国日历、农历节气、日期天气查询、逐小时趋势与10日预报，天气服务由和风天气驱动。',icons:{icon:'/favicon.svg'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}<Toaster className="weather-toaster" theme="dark" position="bottom-center" closeButton visibleToasts={1} duration={6500} containerAriaLabel="提示消息" toastOptions={{closeButtonAriaLabel:'关闭提示'}} offset={{bottom:'max(30px, env(safe-area-inset-bottom))'}} mobileOffset={{bottom:'max(19px, env(safe-area-inset-bottom))'}} style={{'--normal-bg':'#142b41','--normal-text':'#f2f8fd','--normal-border':'#def2ff33','--border-radius':'14px'} as React.CSSProperties}/></body></html>;}

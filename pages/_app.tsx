'use client'

import type { AppProps } from 'next/app'
import { UserProvider } from '../contexts/UserContext'
import '../styles/globals.css'
import { useEffect } from 'react'  // ✅ 新增导入

export default function App({ Component, pageProps }: AppProps) {
  // ✅ 新增：注册 showToast 全局函数，供鸿蒙原生调用
  useEffect(() => {
    // 暴露 alert 到全局，供鸿蒙原生调用
    (window as any).showToast = (message: string) => {
      alert(message);
    };
    console.log('✅ showToast 已注册');
  }, []);

  return (
    <UserProvider>
      <Component {...pageProps} />
    </UserProvider>
  )
}
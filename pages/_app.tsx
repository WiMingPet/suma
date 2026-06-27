'use client'

import type { AppProps } from 'next/app'
import { UserProvider } from '../contexts/UserContext'
import '../styles/globals.css'
import { useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'  // ✅ 新增

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    (window as any).showToast = (message: string) => {
      toast.success(message);
    };
    console.log('✅ showToast 已注册');
  }, []);

  return (
    <UserProvider>
      <Toaster position="top-center" />  {/* ✅ 添加 Toaster 组件 */}
      <Component {...pageProps} />
    </UserProvider>
  )
}
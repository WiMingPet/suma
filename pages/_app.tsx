// pages/_app.tsx
'use client'

import type { AppProps } from 'next/app'
import { UserProvider } from '../contexts/UserContext'
import '../styles/globals.css'
import { useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import PrivacyConsent from '../components/PrivacyConsent'  // ✅ 新增

export default function App({ Component, pageProps }: AppProps) {
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  useEffect(() => {
    // 注册 Toast
    (window as any).showToast = (message: string) => {
      toast.success(message);
    };
    console.log('✅ showToast 已注册');

    // ✅ 检查隐私政策同意状态
    const consented = localStorage.getItem('privacy_consent');
    if (consented === 'true') {
      setHasConsented(true);
    } else {
      setHasConsented(false);
    }
  }, []);

  // ✅ 处理同意
  const handleAgree = () => {
    localStorage.setItem('privacy_consent', 'true');
    setHasConsented(true);
  };

  // 还没检查完，显示空白（避免闪烁）
  if (hasConsented === null) {
    return null;
  }

  return (
    <UserProvider>
      {/* ✅ 隐私政策弹窗 - 未同意时显示 */}
      {!hasConsented && <PrivacyConsent onAgree={handleAgree} />}
      
      <Toaster position="top-center" />
      <Component {...pageProps} />
    </UserProvider>
  )
}
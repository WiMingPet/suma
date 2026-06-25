// lib/payment/platform.ts
import { Capacitor } from '@capacitor/core';
import { PaymentPlatform, PaymentMethod } from './base';

// 检测当前平台
export function getPlatform(): PaymentPlatform {
  if (typeof window === 'undefined') return 'web';

  // ✅ URL 参数优先（鸿蒙 App 传入 ?platform=harmony）
  const params = new URLSearchParams(window.location.search);
  if (params.get('platform') === 'harmony') return 'harmony';

  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }

  const userAgent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';

  return 'web';
}

// 获取支付方式
export function getPaymentMethod(): PaymentMethod {
  const platform = getPlatform();
  if (platform === 'ios') return 'iap';
  if (platform === 'harmony') return 'harmony';
  return 'alipay';
}
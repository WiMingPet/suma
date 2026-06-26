// lib/payment/platform.ts
import { Capacitor } from '@capacitor/core';
import { PaymentPlatform, PaymentMethod } from './base';

export function getPlatform(): PaymentPlatform {
  if (typeof window === 'undefined') return 'web';

  // ✅ 只通过 URL 参数识别鸿蒙（App 传入 ?platform=harmony）
  const params = new URLSearchParams(window.location.search);
  if (params.get('platform') === 'harmony') return 'harmony';

  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }

  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';

  return 'web';
}

export function getPaymentMethod(): PaymentMethod {
  const platform = getPlatform();
  if (platform === 'ios') return 'iap';
  // 鸿蒙走支付宝
  return 'alipay';
}
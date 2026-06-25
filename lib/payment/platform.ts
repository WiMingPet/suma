// lib/payment/platform.ts
import { Capacitor } from '@capacitor/core';
import { PaymentPlatform, PaymentMethod } from './base';

// 检测当前平台
export function getPlatform(): PaymentPlatform {
  if (typeof window === 'undefined') return 'web';

  // ✅ URL 参数优先
  const params = new URLSearchParams(window.location.search);
  if (params.get('platform') === 'harmony') return 'harmony';

  // ✅ UA 兜底检测鸿蒙
  const ua = navigator.userAgent;
  if (/HarmonyOS|ArkWeb/i.test(ua)) return 'harmony';

  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }

  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';

  return 'web';
}

// 获取支付方式
export function getPaymentMethod(): PaymentMethod {
  const platform = getPlatform();
  if (platform === 'ios') return 'iap';
  if (platform === 'harmony') return 'harmony';
  return 'alipay';
}
// lib/payment/platform.ts
import { Capacitor } from '@capacitor/core';
import { PaymentPlatform, PaymentMethod } from './base';

export function getPlatform(): PaymentPlatform {
  if (typeof window === 'undefined') return 'web';

  // 1. 永久标记优先：App 启动时写入 localStorage，怎么跳转都不怕丢
  try {
    if (localStorage.getItem('suma_platform') === 'harmony') return 'harmony';
  } catch (e) {}

  // 2. URL 参数次之
  const params = new URLSearchParams(window.location.search);
  if (params.get('platform') === 'harmony') {
    try {
      localStorage.setItem('suma_platform', 'harmony');
    } catch (e) {}
    return 'harmony';
  }

  // 3. UA 兜底（百度浏览器、鸿蒙WebView）
  const ua = navigator.userAgent;
  if (/HarmonyOS|ArkWeb/i.test(ua)) {
    try {
      localStorage.setItem('suma_platform', 'harmony');
    } catch (e) {}
    return 'harmony';
  }

  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }

  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';

  return 'web';
}

export function getPaymentMethod(): PaymentMethod {
  const platform = getPlatform();
  if (platform === 'ios') return 'iap';
  if (platform === 'harmony') return 'harmony';
  return 'alipay';
}
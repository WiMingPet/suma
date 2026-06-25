// lib/payment/index.ts
export { getPlatform, getPaymentMethod } from './platform';
export type { PaymentPlatform, PaymentMethod, PaymentParams, PaymentResult } from './base';

// 导出各平台函数（供组件调用）
export { fetchProducts, initIAP, restorePurchases } from './ios';

import { getPaymentMethod } from './platform';
import { PaymentParams, PaymentResult } from './base';

// 统一支付入口
export async function initiatePayment(params: PaymentParams): Promise<PaymentResult> {
  const method = getPaymentMethod();

  switch (method) {
    case 'iap': {
      const { initiateIAPPayment } = await import('./ios');
      return initiateIAPPayment(params);
    }
    case 'harmony': {
      const { initiateHarmonyPayment } = await import('./harmony');
      return initiateHarmonyPayment(params);
    }
    default: {
      const { initiateAlipayPayment } = await import('./alipay');
      return initiateAlipayPayment(params);
    }
  }
}
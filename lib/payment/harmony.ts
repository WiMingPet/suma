// lib/payment/harmony.ts
import { PaymentParams, PaymentResult } from './base';

// 鸿蒙支付暂用支付宝，后续接入华为 IAP
export async function initiateHarmonyPayment(params: PaymentParams): Promise<PaymentResult> {
  const { initiateAlipayPayment } = await import('./alipay');
  return initiateAlipayPayment(params);
}
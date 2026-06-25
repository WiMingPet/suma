// lib/payment/alipay.ts
import { PaymentParams, PaymentResult } from './base';

export async function initiateAlipayPayment(params: PaymentParams): Promise<PaymentResult> {
  try {
    const response = await fetch('https://sumaai.cn/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: params.plan,
        amount: params.amount,
        points: params.points,
      }),
    });

    const data = await response.json();

    if (data.code === 200 && data.qrCode) {
      return { success: true, orderId: data.orderId };
    }

    return { success: false, message: data.message || '支付失败' };
  } catch (error) {
    console.error('支付宝支付错误:', error);
    return { success: false, message: '网络错误，请重试' };
  }
}
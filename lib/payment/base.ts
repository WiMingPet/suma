// lib/payment/base.ts

export type PaymentPlatform = 'ios' | 'android' | 'web' | 'harmony';
export type PaymentMethod = 'alipay' | 'iap' | 'harmony';

export interface PaymentParams {
  plan: 'month' | 'season' | 'year';
  amount: string;
  points: number;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  message?: string;
}
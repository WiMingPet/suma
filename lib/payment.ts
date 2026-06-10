// lib/payment.ts
// 统一支付入口，根据平台自动选择支付方式

import { Capacitor } from '@capacitor/core';

export type PaymentPlatform = 'ios' | 'android' | 'web';
export type PaymentMethod = 'alipay' | 'iap';

// 检测当前平台
export function getPlatform(): PaymentPlatform {
  if (typeof window === 'undefined') return 'web';
  
  // Capacitor 环境检测
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

// 获取当前平台应该使用的支付方式
export function getPaymentMethod(): PaymentMethod {
  const platform = getPlatform();
  if (platform === 'ios') return 'iap';
  return 'alipay';
}

// 套餐配置
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

// 产品 ID 映射（需与 App Store Connect 创建的一致）
const PRODUCT_IDS = {
  month: 'com.sumaai.monthly',
  season: 'com.sumaai.seasonal',
  year: 'com.sumaai.yearly',
};

// 动态导入 IAP 插件（避免构建时出错）
let iapPlugin: any = null;

async function getIAPPlugin() {
  if (iapPlugin) return iapPlugin;
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    iapPlugin = NativePurchases;
    return iapPlugin;
  } catch (error) {
    console.error('IAP 插件加载失败:', error);
    return null;
  }
}

// 初始化 IAP（在 App 启动时调用一次）
let iapInitialized = false;
export async function initIAP() {
  if (iapInitialized) return;
  
  const plugin = await getIAPPlugin();
  if (!plugin) {
    console.warn('IAP 插件不可用');
    return;
  }
  
  try {
    // 尝试不同的初始化方法
    if (typeof plugin.initialize === 'function') {
      await plugin.initialize({ productIds: Object.values(PRODUCT_IDS) });
    } else if (typeof plugin.setup === 'function') {
      await plugin.setup({ productIds: Object.values(PRODUCT_IDS) });
    } else if (typeof plugin.configure === 'function') {
      await plugin.configure({ productIds: Object.values(PRODUCT_IDS) });
    } else {
      console.warn('未找到 IAP 初始化方法，插件可能需要不同配置');
    }
    iapInitialized = true;
    console.log('IAP 初始化成功');
  } catch (error) {
    console.error('IAP 初始化失败:', error);
  }
}

// 发起支付（统一入口）
export async function initiatePayment(params: PaymentParams): Promise<PaymentResult> {
  const method = getPaymentMethod();
  
  if (method === 'iap') {
    return initiateIAPPayment(params);
  } else {
    return initiateAlipayPayment(params);
  }
}

// 支付宝支付
async function initiateAlipayPayment(params: PaymentParams): Promise<PaymentResult> {
  try {
    const response = await fetch('https://suma.zeabur.app/api/create-payment', {
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
      if (typeof window !== 'undefined') {
        window.open(data.qrCode);
      }
      return { success: true, orderId: data.orderId };
    }
    
    return { success: false, message: data.message || '支付失败' };
  } catch (error) {
    console.error('支付宝支付错误:', error);
    return { success: false, message: '网络错误，请重试' };
  }
}

// IAP 支付
async function initiateIAPPayment(params: PaymentParams): Promise<PaymentResult> {
  try {
    const plugin = await getIAPPlugin();
    if (!plugin) {
      return { success: false, message: 'IAP 插件未加载' };
    }
    
    await initIAP();
    
    const productId = PRODUCT_IDS[params.plan];
    if (!productId) {
      return { success: false, message: '产品配置错误' };
    }
    
    // 尝试不同的购买方法
    let purchaseResult: any = null;
    
    if (typeof plugin.purchase === 'function') {
      purchaseResult = await plugin.purchase({ productId });
    } else if (typeof plugin.buyProduct === 'function') {
      purchaseResult = await plugin.buyProduct(productId);
    } else if (typeof plugin.buy === 'function') {
      purchaseResult = await plugin.buy(productId);
    } else {
      return { success: false, message: 'IAP 购买方法不可用' };
    }
    
    // 检查购买结果
    const isPurchased = purchaseResult?.purchaseState === 'PURCHASED' || 
                        purchaseResult?.state === 'approved' ||
                        purchaseResult?.success === true;
    
    if (isPurchased) {
      const receipt = purchaseResult.receipt || purchaseResult.transactionReceipt || '';
      const transactionId = purchaseResult.transactionId || purchaseResult.orderId || '';
      
      const verifyResult = await verifyReceiptOnServer(receipt, transactionId, params);
      
      if (verifyResult.success) {
        return { success: true, orderId: transactionId };
      } else {
        return { success: false, message: verifyResult.message || '收据验证失败' };
      }
    }
    
    if (purchaseResult?.purchaseState === 'CANCELLED' || purchaseResult?.state === 'cancelled') {
      return { success: false, message: '已取消购买' };
    }
    
    return { success: false, message: purchaseResult?.message || '购买失败' };
  } catch (error: any) {
    console.error('IAP 支付错误:', error);
    
    if (error?.message?.toLowerCase().includes('cancel')) {
      return { success: false, message: '已取消购买' };
    }
    
    return { success: false, message: error?.message || '支付失败，请重试' };
  }
}

// 服务端验证收据
async function verifyReceiptOnServer(
  receipt: string, 
  transactionId: string, 
  params: PaymentParams
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch('https://suma.zeabur.app/api/verify-iap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt,
        transactionId,
        plan: params.plan,
        amount: params.amount,
        points: params.points,
      }),
    });
    
    const data = await response.json();
    return { success: data.success, message: data.message };
  } catch (error) {
    console.error('收据验证请求失败:', error);
    return { success: false, message: '验证失败，请联系客服' };
  }
}
// lib/payment.ts
import { Capacitor } from '@capacitor/core';
import { NativePurchases, Product } from '@capgo/native-purchases';

export type PaymentPlatform = 'ios' | 'android' | 'web';
export type PaymentMethod = 'alipay' | 'iap';

// 检测当前平台
export function getPlatform(): PaymentPlatform {
  if (typeof window === 'undefined') return 'web';
  
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

// 产品 ID 映射
const PRODUCT_IDS = {
  month: 'com.sumaai.monthly',
  season: 'com.sumaai.seasonal',
  year: 'com.sumaai.yearly',
};

// 缓存产品信息
let cachedProducts: any[] = [];

// 获取产品信息
export async function fetchProducts(): Promise<any[]> {
  if (cachedProducts.length > 0) return cachedProducts;
  
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    const result = await NativePurchases.getProducts({
      productIdentifiers: Object.values(PRODUCT_IDS),
    });
    // 修复：result 可能是一个对象 { products: [...] }
    const products = Array.isArray(result) ? result : (result as any)?.products || [];
    cachedProducts = products;
    return products;
  } catch (error) {
    console.error('获取 IAP 产品失败:', error);
    return [];
  }
}

// 获取产品价格字符串
export async function getProductPrice(productId: string): Promise<string> {
  const products = await fetchProducts();
  const product = products.find((p: any) => p.identifier === productId);
  return product?.priceString || '¥0.00';
}

// 获取所有产品信息
export async function getProductsWithPrices(): Promise<{ id: string; name: string; price: string; points: number }[]> {
  const products = await fetchProducts();
  const planMap: Record<string, { name: string; points: number }> = {
    'com.sumaai.monthly': { name: '月卡', points: 500 },
    'com.sumaai.seasonal': { name: '季卡', points: 1500 },
    'com.sumaai.yearly': { name: '年卡', points: 5000 },
  };
  
  return products.map((p: any) => ({
    id: p.identifier,
    name: planMap[p.identifier]?.name || p.identifier,
    price: p.priceString,
    points: planMap[p.identifier]?.points || 0,
  }));
}

// 动态导入 IAP 插件
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

// 初始化 IAP
let iapInitialized = false;
export async function initIAP() {
  if (iapInitialized) return;
  
  const plugin = await getIAPPlugin();
  if (!plugin) {
    console.warn('IAP 插件不可用');
    return;
  }
  
  try {
    if (typeof plugin.initialize === 'function') {
      await plugin.initialize({
        productIdentifiers: Object.values(PRODUCT_IDS),
      });
    } else if (typeof plugin.setup === 'function') {
      await plugin.setup({
        productIdentifiers: Object.values(PRODUCT_IDS),
      });
    } else {
      console.warn('未找到 IAP 初始化方法');
    }
    iapInitialized = true;
    console.log('IAP 初始化成功');
  } catch (error) {
    console.error('IAP 初始化失败:', error);
  }
}

// 恢复购买
export async function restorePurchases(): Promise<{ success: boolean; message?: string }> {
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    const result = await NativePurchases.restorePurchases();
    
    // 处理恢复结果
    const purchases = Array.isArray(result) ? result : (result as any)?.purchases || [];
    if (purchases.length > 0) {
      for (const purchase of purchases) {
        if (purchase.state === 'approved' || purchase.state === 'purchased') {
          const plan = getPlanFromProductId(purchase.productIdentifier);
          if (plan) {
            await verifyReceiptOnServer(
              purchase.receipt || '',
              purchase.transactionId || '',
              plan
            );
          }
        }
      }
      return { success: true, message: `已恢复 ${purchases.length} 项购买` };
    }
    return { success: true, message: '没有可恢复的购买记录' };
  } catch (error) {
    console.error('恢复购买失败:', error);
    return { success: false, message: '恢复购买失败，请重试' };
  }
}

function getPlanFromProductId(productId: string): PaymentParams | null {
  const map: Record<string, 'month' | 'season' | 'year'> = {
    'com.sumaai.monthly': 'month',
    'com.sumaai.seasonal': 'season',
    'com.sumaai.yearly': 'year',
  };
  const plan = map[productId];
  if (!plan) return null;
  
  const plans = { month: 29.9, season: 69.9, year: 199 };
  const pointsMap = { month: 500, season: 1500, year: 5000 };
  return { plan, amount: String(plans[plan]), points: pointsMap[plan] };
}

// 发起支付
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
    
    let purchaseResult: any = null;
    
    if (typeof plugin.purchase === 'function') {
      purchaseResult = await plugin.purchase({ productIdentifier: productId });
    } else if (typeof plugin.buyProduct === 'function') {
      purchaseResult = await plugin.buyProduct(productId);
    } else if (typeof plugin.buy === 'function') {
      purchaseResult = await plugin.buy(productId);
    } else {
      return { success: false, message: 'IAP 购买方法不可用' };
    }
    
    // 检查购买结果
    const isPurchased = purchaseResult?.state === 'approved' || 
                        purchaseResult?.state === 'purchased' ||
                        purchaseResult?.purchaseState === 'PURCHASED' ||
                        purchaseResult?.success === true;
    
    if (isPurchased) {
      const receipt = purchaseResult.receipt || purchaseResult.transactionReceipt || '';
      const transactionId = purchaseResult.transactionId || purchaseResult.orderId || '';
      
      const verifyResult = await verifyReceiptOnServer(receipt, transactionId, params);
      
      if (verifyResult.success) {
        // 完成交易
        if (typeof plugin.finish === 'function') {
          await plugin.finish(purchaseResult);
        } else if (typeof plugin.finishPurchase === 'function') {
          await plugin.finishPurchase(purchaseResult);
        } else if (typeof plugin.acknowledgePurchase === 'function') {
          await plugin.acknowledgePurchase(purchaseResult);
        }
        return { success: true, orderId: transactionId };
      } else {
        return { success: false, message: verifyResult.message || '收据验证失败' };
      }
    }
    
    if (purchaseResult?.state === 'cancelled' || purchaseResult?.purchaseState === 'CANCELLED') {
      return { success: false, message: '已取消购买' };
    }
    
    return { success: false, message: purchaseResult?.message || purchaseResult?.errorMessage || '购买失败' };
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
    const response = await fetch('https://sumaai.cn/api/verify-iap', {
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
// lib/store.ts

export interface VerificationCode {
  code: string;
  expires: number;
}

export interface UserSession {
  phone: string;
  isPro: boolean;
  proExpiresAt?: number;
  createdAt: number;
}

export interface Order {
  id: string;
  userId: string;
  amount: number;
  points?: number;
  status: 'pending' | 'paid' | 'expired';
  createdAt: number;
  paidAt?: number;
  tradeNo?: string;
}

// 验证码存储
export const codeStore = new Map<string, VerificationCode>();

// 用户会话存储（模拟数据库）
export const userStore = new Map<string, UserSession>();

// 订单存储
export const orderStore = new Map<string, Order>();

// 清理过期数据（每小时执行一次）
setInterval(() => {
  const now = Date.now();
  // 清理过期的验证码
  codeStore.forEach((data, phone) => {
    if (data.expires < now) codeStore.delete(phone);
  });
  // 清理过期的会员状态
  userStore.forEach((session) => {
    if (session.proExpiresAt && session.proExpiresAt < now) {
      session.isPro = false;
    }
  });
}, 60 * 60 * 1000);
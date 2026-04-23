// lib/store.ts

export interface VerificationCode {
  code: string;
  expires: number;
}

export interface UserRecord {
  phone: string;
  passwordHash?: string;
  isPro: boolean;
  dailyCount: number;      // 已使用次数，初始为 0
  lastLoginDate: number;
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

// 用户数据存储（内存）
export const userStore = new Map<string, UserRecord>();

// 订单存储
export const orderStore = new Map<string, Order>();

// 获取用户
export function getUser(phone: string): UserRecord | undefined {
  return userStore.get(phone);
}

// 获取或创建用户（新用户 dailyCount = 0）
export function getOrCreateUser(phone: string): UserRecord {
  let user = userStore.get(phone);
  if (!user) {
    user = {
      phone,
      isPro: false,
      dailyCount: 0,           // ✅ 已使用次数为 0
      lastLoginDate: Date.now(),
      createdAt: Date.now(),
    };
    userStore.set(phone, user);
  }
  return user;
}

// 创建或更新用户
export function createOrUpdateUser(phone: string, data: Partial<UserRecord>): UserRecord {
  let user = userStore.get(phone);
  if (!user) {
    user = {
      phone,
      isPro: false,
      dailyCount: 0,           // ✅ 已使用次数为 0
      lastLoginDate: Date.now(),
      createdAt: Date.now(),
    };
  }
  Object.assign(user, data);
  userStore.set(phone, user);
  return user;
}

// 重置每日次数（如果跨天）
export function resetDailyCountIfNeeded(user: UserRecord): void {
  const today = new Date().setHours(0, 0, 0, 0);
  const lastLoginDay = new Date(user.lastLoginDate).setHours(0, 0, 0, 0);
  if (lastLoginDay !== today) {
    user.dailyCount = 0;       // ✅ 重置为 0
    user.lastLoginDate = Date.now();
    userStore.set(user.phone, user);
  }
}

// 清理过期数据（每小时执行一次）
setInterval(() => {
  const now = Date.now();
  // 清理过期的验证码
  codeStore.forEach((data, phone) => {
    if (data.expires < now) codeStore.delete(phone);
  });
}, 60 * 60 * 1000);
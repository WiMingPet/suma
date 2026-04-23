// lib/store.ts
export interface UserRecord {
  phone: string;
  passwordHash?: string;      // bcrypt 哈希后的密码（可选）
  isPro: boolean;
  dailyCount: number;         // 当日已用次数
  lastLoginDate: number;      // 上次登录日期（用于重置每日次数）
  createdAt: number;
}

// 用户数据存储（内存）
export const userStore = new Map<string, UserRecord>();

// 验证码存储（5分钟过期）
export const codeStore = new Map<string, { code: string; expires: number }>();

// 辅助函数：获取或初始化用户
export function getUser(phone: string): UserRecord | undefined {
  return userStore.get(phone);
}

export function createOrUpdateUser(phone: string, data: Partial<UserRecord>): UserRecord {
  let user = userStore.get(phone);
  if (!user) {
    user = {
      phone,
      isPro: false,
      dailyCount: 0,
      lastLoginDate: Date.now(),
      createdAt: Date.now(),
    };
    userStore.set(phone, user);
  }
  Object.assign(user, data);
  userStore.set(phone, user);
  return user;
}

// 重置每日次数（每天首次登录时调用）
export function resetDailyCountIfNeeded(user: UserRecord): void {
  const today = new Date().setHours(0, 0, 0, 0);
  const lastLoginDay = new Date(user.lastLoginDate).setHours(0, 0, 0, 0);
  if (lastLoginDay !== today) {
    user.dailyCount = 0;
    user.lastLoginDate = Date.now();
    userStore.set(user.phone, user);
  }
}
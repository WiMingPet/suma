// lib/store.ts

export interface VerificationCode {
  code: string;
  expires: number;
}

// 验证码存储（内存，临时）
export const codeStore = new Map<string, VerificationCode>();

// 清理过期数据（每小时执行一次）
setInterval(() => {
  const now = Date.now();
  codeStore.forEach((data, phone) => {
    if (data.expires < now) codeStore.delete(phone);
  });
}, 60 * 60 * 1000);
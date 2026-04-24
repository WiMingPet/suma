// pages/api/user-info.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getOrCreateUser, resetDailyCountIfNeeded } from '../../lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];
  let phone: string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    phone = decoded.phone;
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }

  // 获取或创建用户
  const user = getOrCreateUser(phone);
  resetDailyCountIfNeeded(user);

  res.status(200).json({
    success: true,
    user: {
      id: phone,
      phone,
      is_pro: user.isPro,
      daily_count: user.dailyCount,  // 返回已使用次数，不是剩余次数
      free_used: freeUsed,
    }
  });
}
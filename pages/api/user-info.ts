// pages/api/user-info.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getUser } from '../../lib/store';
import { getFreeUsed, getUserPoints } from '../../lib/orderService';

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

  // 获取用户（从内存）
  const user = getUser(phone);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // 从数据库获取免费已使用次数和点币余额
  const freeUsed = await getFreeUsed(phone);
  const points = await getUserPoints(phone);

  res.status(200).json({
    success: true,
    user: {
      id: phone,
      phone,
      is_pro: user.isPro,
      daily_count: user.dailyCount,
      free_used: freeUsed,
      points: points,  // 新增：点币余额
    }
  });
}
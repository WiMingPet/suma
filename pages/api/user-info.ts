// pages/api/user-info.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getOrCreateUserInDB, getUserPoints } from '../../lib/orderService';

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

  // 从数据库获取用户信息
  const userRecord = await getOrCreateUserInDB(phone);
  const points = await getUserPoints(phone);

  res.status(200).json({
    success: true,
    user: {
      id: phone,
      phone,
      is_pro: userRecord.is_pro,
      daily_count: 0,  // 保留兼容，不再使用
      free_used: userRecord.free_used,
      points: points,
    }
  });
}
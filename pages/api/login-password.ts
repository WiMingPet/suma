// pages/api/login-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getUser, createOrUpdateUser } from '../../lib/store';
import { getFreeUsed } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: '手机号和密码不能为空' });
  }

  const user = getUser(phone);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: '手机号或密码错误' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: '手机号或密码错误' });
  }

  // 注意：不再调用 resetDailyCountIfNeeded（永久免费3次）

  // 从数据库获取免费已使用次数
  const freeUsed = await getFreeUsed(phone);

  const token = jwt.sign(
    { phone, loginAt: Date.now() },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.status(200).json({
    success: true,
    token,
    user: {
      id: phone,
      phone,
      is_pro: user.isPro,
      daily_count: user.dailyCount,  // 返回已使用次数
      free_used: freeUsed,           // 免费已使用次数
    },
  });
}
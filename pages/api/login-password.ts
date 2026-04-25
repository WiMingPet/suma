// pages/api/login-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getOrCreateUserInDB, getUserPoints, getPasswordHash } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: '手机号和密码不能为空' });
  }

  // 从数据库获取密码哈希
  const passwordHash = await getPasswordHash(phone);
  if (!passwordHash) {
    return res.status(401).json({ error: '手机号或密码错误' });
  }

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    return res.status(401).json({ error: '手机号或密码错误' });
  }

  // 从数据库获取或创建用户记录
  const userRecord = await getOrCreateUserInDB(phone);
  const points = await getUserPoints(phone);

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
      is_pro: userRecord.is_pro,
      daily_count: 0,
      free_used: userRecord.free_used,
      points: points,
    },
  });
}
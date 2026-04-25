// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { codeStore } from '../../lib/store';
import { getOrCreateUserInDB, getUserPoints } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: '手机号和验证码不能为空' });
  }

  const stored = codeStore.get(phone);
  if (!stored || stored.code !== code || stored.expires < Date.now()) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }

  // 清除已使用的验证码
  codeStore.delete(phone);

  // 从数据库获取或创建用户
  const userRecord = await getOrCreateUserInDB(phone);
  
  // 从数据库获取点币余额
  const points = await getUserPoints(phone);

  // 生成 JWT token
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
      daily_count: 0,  // 保留兼容，不再使用
      free_used: userRecord.free_used,
      points: points,
    },
  });
}
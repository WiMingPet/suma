// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { codeStore, getOrCreateUser } from '../../lib/store';
import { getFreeUsed } from '../../lib/orderService';

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

  // 获取或创建用户
  let user = getOrCreateUser(phone);
  // 注意：不再调用 resetDailyCountIfNeeded（永久免费3次）

  // 从数据库获取免费已使用次数
  const freeUsed = await getFreeUsed(phone);

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
      is_pro: user.isPro,
      daily_count: user.dailyCount,  // 返回已使用次数
      free_used: freeUsed,           // 免费已使用次数
    },
  });
}
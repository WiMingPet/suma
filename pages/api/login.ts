// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { codeStore, userStore, UserSession } from '../../lib/store';

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

  // 生成 JWT token
  const token = jwt.sign(
    { phone, loginAt: Date.now() },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  // 存储用户会话
  let user = userStore.get(phone);
  if (!user) {
    user = {
      phone,
      isPro: false,
      createdAt: Date.now(),
    };
    userStore.set(phone, user);
  }

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user.phone,
      phone: user.phone,
      is_pro: user.isPro,
      daily_count: 3,
    },
  });
}
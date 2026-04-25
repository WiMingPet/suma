// pages/api/set-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { setPasswordHash } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  const hashed = await bcrypt.hash(password, 10);
  await setPasswordHash(phone, hashed);

  res.status(200).json({ success: true });
}
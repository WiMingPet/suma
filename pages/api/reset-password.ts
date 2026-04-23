// pages/api/reset-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { codeStore, createOrUpdateUser } from '../../lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, code, newPassword } = req.body;
  if (!phone || !code || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '参数错误或密码太短' });
  }

  const stored = codeStore.get(phone);
  if (!stored || stored.code !== code || stored.expires < Date.now()) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }

  codeStore.delete(phone);

  const hashed = await bcrypt.hash(newPassword, 10);
  createOrUpdateUser(phone, { passwordHash: hashed });

  res.status(200).json({ success: true });
}
// pages/api/reset-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { codeStore } from '../../lib/store';
import { setPasswordHash, getOrCreateUserInDB } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, code, newPassword } = req.body;

  if (!phone || !code || !newPassword) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  // 验证验证码
  const stored = codeStore.get(phone);
  if (!stored || stored.code !== code || stored.expires < Date.now()) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }

  // 清除验证码
  codeStore.delete(phone);

  // 加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 保存到数据库
  await setPasswordHash(phone, hashedPassword);
  
  // 确保用户存在
  await getOrCreateUserInDB(phone);

  res.status(200).json({ success: true, message: '密码重置成功' });
}
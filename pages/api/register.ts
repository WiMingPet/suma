// pages/api/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { getPasswordHash, setPasswordHash, getOrCreateUserInDB } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, password, code } = req.body;

  // 验证手机号
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号' });
  }

  // 验证密码
  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码长度不能少于6位' });
  }

  // 验证验证码（从 codeStore 读取）
  const { codeStore } = await import('../../lib/store');
  const storedCode = codeStore.get(phone);
  if (!storedCode || storedCode.code !== code || storedCode.expires < Date.now()) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }
  
  // 验证通过后删除验证码
  codeStore.delete(phone);

  try {
    // 从数据库检查用户是否已有密码（已注册）
    const existingHash = await getPasswordHash(phone);
    if (existingHash) {
      return res.status(400).json({ error: '该手机号已注册，请直接登录' });
    }

    // 使用 bcrypt 加密密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 保存密码哈希到数据库
    await setPasswordHash(phone, passwordHash);
    
    // 创建或更新用户记录（数据库）
    const userRecord = await getOrCreateUserInDB(phone);
    
    console.log(`[REGISTER] 用户注册成功: ${phone}`);
    
    res.status(200).json({
      success: true,
      message: '注册成功'
    });
  } catch (error) {
    console.error('[REGISTER] 注册失败:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
}
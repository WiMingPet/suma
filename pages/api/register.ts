// pages/api/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { getUser } from '../../lib/store';
import { setPasswordHash, getOrCreateUserInDB } from '../../lib/orderService';

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

  // 验证验证码（开发环境：123456）
  if (!code || code !== '123456') {
    return res.status(400).json({ error: '验证码错误' });
  }

  try {
    // 检查用户是否已存在且有密码（已注册）
    const existingUser = getUser(phone);
    
    if (existingUser && existingUser.passwordHash) {
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
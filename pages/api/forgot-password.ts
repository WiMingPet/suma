// pages/api/forgot-password.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { codeStore } from '../../lib/store';
// 复用发送短信的逻辑
import sendSmsHandler from './send-sms';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式错误' });
  }

  // 直接调用发送验证码的逻辑（复用 send-sms 的核心）
  // 为了简单，我们可以直接调用 send-sms 的处理，但需要修改 send-sms 导出函数。
  // 这里为了独立，复制一份发送逻辑（或重构）。简单起见，我们复制发送代码。
  // 为避免重复，建议将发送逻辑抽离到 lib/sms.ts。这里先直接写。
  
  // 频率限制
  const lastSent = codeStore.get(`${phone}_last`);
  if (lastSent && lastSent.expires > Date.now()) {
    return res.status(429).json({ error: '发送太频繁，请稍后再试' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000;
  codeStore.set(phone, { code, expires });
  codeStore.set(`${phone}_last`, { code, expires: Date.now() + 60 * 1000 });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] 重置密码验证码: ${code} 发送给 ${phone}`);
    return res.status(200).json({ success: true, devCode: code });
  }

  // 调用阿里云短信（同 send-sms）
  // 这里省略，复用上面的代码，建议抽离
  // 实际项目中请将发送逻辑抽取到单独文件
  res.status(200).json({ success: true });
}
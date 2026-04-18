// pages/api/send-sms.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Dysmsapi, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import { codeStore } from '../../lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式错误' });
  }

  // 频率限制：同一手机号60秒内只能发送一次
  const lastSent = codeStore.get(`${phone}_last`);
  if (lastSent && lastSent.expires > Date.now() - 60000) {
    return res.status(429).json({ error: '发送太频繁，请稍后再试' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000;

  // 存储验证码
  codeStore.set(phone, { code, expires });
  codeStore.set(`${phone}_last`, { code, expires: Date.now() + 60000 });

  // 本地开发环境不发送真实短信
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] 验证码 ${code} 发送给 ${phone}`);
    return res.status(200).json({ success: true, devCode: code });
  }

  try {
    const config = new OpenApi.Config({
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    });
    config.endpoint = 'dysmsapi.aliyuncs.com';
    const client = new Dysmsapi(config);

    const sendReq = new SendSmsRequest({
      phoneNumbers: phone,
      signName: process.env.ALIYUN_SMS_SIGN_NAME,
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    });
    const response = await client.sendSms(sendReq);
    if (response.body.code === 'OK') {
      res.status(200).json({ success: true });
    } else {
      throw new Error(response.body.message);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '发送失败，请稍后重试' });
  }
}
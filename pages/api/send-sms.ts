// pages/api/send-sms.ts - 发送短信验证码
import type { NextApiRequest, NextApiResponse } from 'next'
import { sendSmsCode, storeCode } from '../../lib/tencent-sms'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('========== 收到发送验证码请求 ==========')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { phone } = req.body
  console.log('手机号:', phone)

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    console.log('手机号无效')
    return res.status(400).json({ error: '请输入有效的手机号' })
  }

  try {
    console.log('调用 sendSmsCode...')
    const result = await sendSmsCode(phone)
    console.log('sendSmsCode 返回结果:', result)

    if (result.success && result.code) {
      storeCode(phone, result.code)
      console.log('验证码已存储')
      return res.status(200).json({ success: true })
    }

    console.log('发送失败:', result.error)
    return res.status(500).json({ error: result.error || '发送失败' })
  } catch (error) {
    console.error('捕获到错误:', error)
    return res.status(500).json({ error: '服务器内部错误' })
  }
}
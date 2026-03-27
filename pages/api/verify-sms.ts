import type { NextApiRequest, NextApiResponse } from 'next'
import { getStoredCode } from '../../lib/tencent-sms'

// 使用全局变量共享用户数据
declare global {
  var _localUsers: Record<string, any>
}

// 确保全局变量存在
if (!global._localUsers) {
  global._localUsers = {}
}
const localUsers = global._localUsers

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { phone, code } = req.body

  console.log('========== 验证请求 ==========')
  console.log('手机号:', phone)
  console.log('输入的验证码:', code)

  if (!phone || !code) {
    return res.status(400).json({ error: '请填写完整信息' })
  }

  const storedCode = getStoredCode(phone)
  console.log('存储的验证码:', storedCode)

  if (storedCode === code) {
    console.log('✅ 验证成功')
    
    let userData = localUsers[phone]
    
    if (!userData) {
      userData = {
        id: phone,
        phone: phone,
        is_pro: false,
        daily_count: 0
      }
      localUsers[phone] = userData
      console.log('✅ 创建本地用户:', userData)
      console.log('当前所有用户:', Object.keys(localUsers))
    } else {
      console.log('用户已存在:', userData)
    }
    
    return res.status(200).json({ 
      success: true, 
      user: userData
    })
  } else {
    console.log('❌ 验证失败')
    return res.status(400).json({ error: '验证码错误' })
  }
}
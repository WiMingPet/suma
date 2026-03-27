import type { NextApiRequest, NextApiResponse } from 'next'

declare global {
  var _localUsers: Record<string, any>
}

if (!global._localUsers) {
  global._localUsers = {}
}
const localUsers = global._localUsers

// 免费用户每日最大次数
const MAX_FREE = 3

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.body

  console.log('========== check-limit ==========')
  console.log('userId:', userId)
  console.log('当前所有用户:', Object.keys(localUsers))

  if (!userId) {
    return res.status(400).json({ error: '用户ID不能为空' })
  }

  const user = localUsers[userId]

  if (!user) {
    console.log('用户不存在:', userId)
    return res.status(404).json({ error: '用户不存在' })
  }

  // 计算剩余次数：Pro会员无限(-1)，免费用户 = 最大次数 - 已用次数
  const remaining = user.is_pro ? -1 : (MAX_FREE - (user.daily_count || 0))
  console.log('剩余次数:', remaining)
  
  return res.status(200).json({
    success: true,
    remaining,
    canGenerate: user.is_pro || (user.daily_count || 0) < MAX_FREE
  })
}
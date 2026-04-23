import type { NextApiRequest, NextApiResponse } from 'next'

declare global {
  var _localUsers: Record<string, any>
}

if (!global._localUsers) {
  global._localUsers = {}
}
const localUsers = global._localUsers

const MAX_FREE = 3

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: '用户ID不能为空' })
  }

  const user = localUsers[userId]

  // 关键修改：用户不存在时，返回默认值，而不是 404
  if (!user) {
    console.log('用户不存在，返回默认值:', userId)
    return res.status(200).json({
      success: true,
      remaining: MAX_FREE,
      canGenerate: true
    })
  }

  const remaining = user.is_pro ? -1 : (MAX_FREE - (user.daily_count || 0))
  
  return res.status(200).json({
    success: true,
    remaining,
    canGenerate: user.is_pro || (user.daily_count || 0) < MAX_FREE
  })
}
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' })
  }

  // 临时返回，让前端正常工作
  return res.status(200).json({
    success: true,
    user: {
      id: 'temp',
      phone: 'temp',
      is_pro: false,
      daily_count: 3
    }
  })
}
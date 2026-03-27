// pages/api/my-apps.ts - 获取用户应用列表
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: '缺少用户ID' })
  }

  // 从本地存储获取（实际项目中应从 Supabase 获取）
  // 这里返回空数组，客户端会从 localStorage 读取
  return res.status(200).json({ apps: [] })
}
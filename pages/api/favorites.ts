// pages/api/favorites.ts - 收藏功能
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, appId, action } = req.body

  if (req.method === 'POST') {
    // 添加收藏
    if (action === 'add') {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: userId,
          app_id: appId
        })

      if (error) {
        return res.status(500).json({ error: '收藏失败' })
      }

      return res.status(200).json({ success: true })
    }

    // 取消收藏
    if (action === 'remove') {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('app_id', appId)

      if (error) {
        return res.status(500).json({ error: '取消收藏失败' })
      }

      return res.status(200).json({ success: true })
    }
  }

  if (req.method === 'GET') {
    // 获取收藏列表
    const { data: favorites } = await supabase
      .from('favorites')
      .select('*, apps(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return res.status(200).json({ favorites })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
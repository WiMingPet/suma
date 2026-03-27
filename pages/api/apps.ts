import type { NextApiRequest, NextApiResponse } from 'next'

// 本地存储（演示用）
const appsStore: Record<string, any[]> = {}
const favoritesStore: Record<string, string[]> = {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const { action, appId, app } = req.body
  
  // 获取 userId：GET 请求从 query 获取，POST 请求从 body 获取
  let userId = req.query.userId as string
  if (method === 'POST' && req.body.userId) {
    userId = req.body.userId
  }

  if (!userId) {
    return res.status(401).json({ error: '未登录' })
  }

  // 获取我的应用列表
  if (method === 'GET' && req.query.type === 'apps') {
    const apps = appsStore[userId] || []
    return res.status(200).json({ success: true, apps })
  }

  // 获取我的收藏列表
  if (method === 'GET' && req.query.type === 'favorites') {
    const favoriteIds = favoritesStore[userId] || []
    const allApps = appsStore[userId] || []
    const favoriteApps = allApps.filter(app => favoriteIds.includes(app.id))
    return res.status(200).json({ success: true, apps: favoriteApps })
  }

  // 保存应用
  if (method === 'POST' && action === 'save') {
    if (!app) {
      return res.status(400).json({ error: '应用数据不能为空' })
    }
    if (!appsStore[userId]) {
      appsStore[userId] = []
    }
    appsStore[userId].unshift(app)
    return res.status(200).json({ success: true })
  }

  // 删除应用
  if (method === 'POST' && action === 'delete') {
    if (!appId) return res.status(400).json({ error: '应用ID不能为空' })
    if (appsStore[userId]) {
      appsStore[userId] = appsStore[userId].filter(a => a.id !== appId)
    }
    if (favoritesStore[userId]) {
      favoritesStore[userId] = favoritesStore[userId].filter(id => id !== appId)
    }
    return res.status(200).json({ success: true })
  }

  // 添加收藏
  if (method === 'POST' && action === 'favorite') {
    if (!appId) return res.status(400).json({ error: '应用ID不能为空' })
    if (!favoritesStore[userId]) favoritesStore[userId] = []
    if (!favoritesStore[userId].includes(appId)) {
      favoritesStore[userId].push(appId)
    }
    return res.status(200).json({ success: true })
  }

  // 取消收藏
  if (method === 'POST' && action === 'unfavorite') {
    if (!appId) return res.status(400).json({ error: '应用ID不能为空' })
    if (favoritesStore[userId]) {
      favoritesStore[userId] = favoritesStore[userId].filter(id => id !== appId)
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
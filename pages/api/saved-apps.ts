// pages/api/saved-apps.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  // 获取用户ID（从请求头或query中获取）
  const userId = req.headers['x-user-id'] as string || req.query.userId as string;
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  switch (method) {
    case 'GET':
      return getApps(userId, res);
    case 'POST':
      return saveApp(userId, req.body, res);
    case 'DELETE':
      return deleteApp(userId, req.body, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// 获取用户的所有应用
async function getApps(userId: string, res: NextApiResponse) {
  try {
    const result = await query(
      `SELECT app_id, name, code, type, created_at 
       FROM saved_apps 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    const apps = result.rows.map(row => ({
      id: row.app_id,
      name: row.name,
      code: row.code,
      type: row.type,
      created_at: row.created_at,
    }));

    return res.status(200).json({ success: true, apps });
  } catch (error) {
    console.error('获取应用列表失败:', error);
    return res.status(500).json({ error: '获取失败' });
  }
}

// 保存新应用
async function saveApp(userId: string, body: any, res: NextApiResponse) {
  try {
    const { id, name, code, type, created_at } = body;

    if (!id || !name || !code) {
      return res.status(400).json({ error: '缺少必要字段' });
    }

    await query(
      `INSERT INTO saved_apps (app_id, user_id, name, code, type, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (app_id) DO NOTHING`,
      [id, userId, name, code, type || 'text', created_at || new Date().toISOString()]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('保存应用失败:', error);
    return res.status(500).json({ error: '保存失败' });
  }
}

// 删除应用
async function deleteApp(userId: string, body: any, res: NextApiResponse) {
  try {
    const { id } = body;

    if (!id) {
      return res.status(400).json({ error: '缺少应用ID' });
    }

    await query(
      `DELETE FROM saved_apps WHERE app_id = $1 AND user_id = $2`,
      [id, userId]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('删除应用失败:', error);
    return res.status(500).json({ error: '删除失败' });
  }
}
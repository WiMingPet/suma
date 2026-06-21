// pages/api/tasks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'] as string || req.query.userId as string;
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const result = await query(
      `SELECT task_id, type, status, name, created_at, updated_at 
       FROM tasks 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    );

    const tasks = result.rows.map(row => ({
      id: row.task_id,
      type: row.type,
      status: row.status,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.status(200).json({ success: true, tasks });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return res.status(500).json({ error: '获取失败' });
  }
}
// pages/api/delete-account.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: '缺少用户ID' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 删除关联数据
    await client.query('DELETE FROM user_points WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM saved_apps WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM orders WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM tasks WHERE user_id = $1', [userId]);

    // 删除用户
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rowCount === 0) {
      throw new Error('用户不存在');
    }

    await client.query('COMMIT');

    res.status(200).json({ success: true, message: '账号已删除' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('删除账号失败:', error);
    res.status(500).json({ error: '删除账号失败，请稍后再试' });
  } finally {
    client.release();
  }
}
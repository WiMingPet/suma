import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST：保存代码，返回临时ID
  if (req.method === 'POST') {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '缺少代码' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await query('INSERT INTO download_temp (id, code, created_at) VALUES ($1, $2, NOW())', [id, code]);
    
    // 自动清理超过10分钟的旧数据
    await query("DELETE FROM download_temp WHERE created_at < NOW() - INTERVAL '10 minutes'");
    
    return res.status(200).json({ id });
  }

  // GET：根据ID返回文件下载
  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).send('缺少ID');
    
    const result = await query('SELECT code FROM download_temp WHERE id = $1', [id as string]);
    if (result.rows.length === 0) return res.status(404).send('链接已过期，请重新下载');
    
    const code = result.rows[0].code;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="app.html"');
    return res.send(code);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
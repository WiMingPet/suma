// pages/api/log.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 打印接收到的日志
  console.log('📱 [App Log]', {
    level: req.body?.level || 'info',
    message: req.body?.message,
    stack: req.body?.stack,
    url: req.body?.url,
    timestamp: req.body?.timestamp || new Date().toISOString(),
    userAgent: req.headers['user-agent'],
  });

  // 如果有额外数据也打印出来
  if (req.body?.extra) {
    console.log('📱 [App Log Extra]', req.body.extra);
  }

  res.status(200).json({ success: true });
}
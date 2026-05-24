// pages/api/report.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, reason, userId, timestamp } = req.body;

  // 这里可以将举报信息保存到数据库
  console.log('收到举报:', { userId, reason, timestamp, contentLength: content?.length });

  // 可选：发送邮件通知
  // await fetch('https://your-mail-api.com/send', { ... });

  res.status(200).json({ success: true });
}
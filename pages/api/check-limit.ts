// pages/api/check-limit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUser } from '../../lib/store';

const MAX_FREE = 3;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: '用户ID不能为空' });
  }

  const user = getUser(userId);

  if (!user) {
    // 用户不存在时返回默认值
    return res.status(200).json({
      success: true,
      remaining: MAX_FREE,
      canGenerate: true,
    });
  }

  const remaining = user.isPro ? -1 : Math.max(0, MAX_FREE - user.dailyCount);

  return res.status(200).json({
    success: true,
    remaining,
    canGenerate: user.isPro || user.dailyCount < MAX_FREE,
  });
}
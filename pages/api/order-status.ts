// pages/api/order-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { outTradeNo } = req.query;

  if (!outTradeNo) {
    return res.status(400).json({ error: '缺少订单号' });
  }

  try {
    // 查询订单状态
    const result = await query(
      'SELECT status FROM orders WHERE out_trade_no = $1',
      [outTradeNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const status = result.rows[0].status;
    return res.status(200).json({ 
      success: true, 
      status: status,
      isPaid: status === 'paid'
    });
  } catch (error) {
    console.error('查询订单状态失败:', error);
    return res.status(500).json({ error: '查询失败' });
  }
}
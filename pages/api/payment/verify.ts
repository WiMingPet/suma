// pages/api/payment/verify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getOrder } from '../../../lib/orderService';
import { createOrUpdateUser } from '../../../lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { out_trade_no } = req.body;

  if (!out_trade_no) {
    return res.status(400).json({ error: '缺少订单号' });
  }

  // 从内存获取订单
  const order = await getOrder(out_trade_no);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if (order.status === 'paid') {
    return res.status(200).json({ success: true, message: '已支付' });
  }

  // 等待支付宝回调更新状态（最多等待5秒）
  let waitCount = 0;
  while (waitCount < 10) {
    const currentOrder = await getOrder(out_trade_no);
    if (currentOrder?.status === 'paid') {
      return res.status(200).json({ success: true, message: '支付成功' });
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    waitCount++;
  }
  // 如果等待超时，返回未支付
  return res.status(200).json({ success: false, error: '订单未支付' });
}
import type { NextApiRequest, NextApiResponse } from 'next';
import { orders } from './create-payment';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { outTradeNo } = req.query;
  const order = orders.get(outTradeNo as string);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.status(200).json({ status: order.status });
}
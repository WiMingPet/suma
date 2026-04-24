// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { orders } from './create-payment';
import { createOrUpdateUser } from '../../lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('fail');
  }

  try {
    const params = req.body;
    console.log('支付宝回调:', params);

    const { trade_status, out_trade_no } = params;

    const order = orders.get(out_trade_no);
    if (!order) {
      console.error(`订单不存在: ${out_trade_no}`);
      return res.status(404).send('fail');
    }

    if (trade_status === 'TRADE_SUCCESS') {
      order.status = 'paid';
      createOrUpdateUser(order.userId, { isPro: true });
      console.log(`支付成功: ${out_trade_no}, 用户 ${order.userId} 已升级 Pro`);
    }

    res.status(200).send('success');
  } catch (error) {
    console.error('回调处理失败:', error);
    res.status(500).send('fail');
  }
}
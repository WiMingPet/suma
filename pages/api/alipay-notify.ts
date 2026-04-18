// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import AlipaySdk from 'alipay-sdk';
import { orderStore, userStore } from '../../lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID!,
    privateKey: process.env.ALIPAY_PRIVATE_KEY!,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
  });

  // 验证签名
  const verified = alipaySdk.checkNotifySign(req.body);
  if (!verified) {
    return res.status(400).send('fail');
  }

  const { out_trade_no, trade_no, trade_status } = req.body;

  if (trade_status === 'TRADE_SUCCESS') {
    const order = orderStore.get(out_trade_no);
    if (order && order.status === 'pending') {
      // 更新订单状态
      order.status = 'paid';
      order.paidAt = Date.now();
      order.tradeNo = trade_no;
      orderStore.set(out_trade_no, order);

      // 更新用户会员状态
      const user = userStore.get(order.userId);
      if (user) {
        user.isPro = true;
        user.proExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30天
        userStore.set(order.userId, user);
      }
    }
  }

  res.status(200).send('success');
}
// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as AlipaySdk from 'alipay-sdk';
import { orders } from './create-payment';
import { createOrUpdateUser } from '../../lib/store';

const AlipaySdkClass = (AlipaySdk as any).default || AlipaySdk;

const alipaySdk = new AlipaySdkClass({
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!,
  alipayPublicKey: process.env.ALIPAY_ALIPAY_PUBLIC_KEY!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('fail');

  try {
    const params = req.body;
    const isValid = alipaySdk.checkNotifySign(params);
    if (!isValid) return res.status(400).send('fail');

    const { trade_status, out_trade_no } = params;
    const order = orders.get(out_trade_no);
    if (!order) return res.status(404).send('fail');

    if (trade_status === 'TRADE_SUCCESS') {
      order.status = 'paid';
      // 升级为 Pro 会员
      createOrUpdateUser(order.userId, { isPro: true });
      console.log(`订单 ${out_trade_no} 支付成功，用户 ${order.userId} 已升级为 Pro`);
    }
    res.status(200).send('success');
  } catch (error) {
    console.error(error);
    res.status(500).send('fail');
  }
}
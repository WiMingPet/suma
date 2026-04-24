// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import { orders } from './create-payment';
import { createOrUpdateUser } from '../../lib/store';

const AlipaySdk = require('alipay-sdk').default;

function getPrivateKey(): string {
  const keyPath = process.env.ALIPAY_PRIVATE_KEY_PATH || '/app/alipay_private_key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    return process.env.ALIPAY_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  }
}

function getAlipayPublicKey(): string {
  const keyPath = process.env.ALIPAY_PUBLIC_KEY_PATH || '/app/alipay_public_key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    return process.env.ALIPAY_ALIPAY_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
  }
}

const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: getPrivateKey(),
  alipayPublicKey: getAlipayPublicKey(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('fail');
  }

  try {
    const params = req.body;
    console.log('支付宝回调参数:', params);

    // 验证签名
    const isValid = alipaySdk.checkNotifySign(params);
    if (!isValid) {
      console.error('签名验证失败');
      return res.status(400).send('fail');
    }

    const { trade_status, out_trade_no } = params;

    // 验证订单
    const order = orders.get(out_trade_no);
    if (!order) {
      console.error(`订单不存在: ${out_trade_no}`);
      return res.status(404).send('fail');
    }

    // 更新订单和用户状态
    if (trade_status === 'TRADE_SUCCESS') {
      order.status = 'paid';
      createOrUpdateUser(order.userId, { isPro: true });
      console.log(`订单 ${out_trade_no} 支付成功，用户 ${order.userId} 已升级为 Pro`);
    }

    res.status(200).send('success');
  } catch (error) {
    console.error('处理回调失败:', error);
    res.status(500).send('fail');
  }
}
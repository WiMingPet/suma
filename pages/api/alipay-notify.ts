// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { orders } from './create-payment';
import { createOrUpdateUser } from '../../lib/store';

// 验证支付宝签名
function verifySign(params: Record<string, string>, publicKey: string): boolean {
  const sign = params.sign;
  delete params.sign;
  delete params.sign_type;

  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result: Record<string, string>, key) => {
      if (params[key]) {
        result[key] = params[key];
      }
      return result;
    }, {});

  const signContent = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(signContent);
  verify.end();
  return verify.verify(publicKey, sign, 'base64');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('fail');
  }

  try {
    const params = req.body;
    console.log('支付宝回调参数:', params);

    // 验证签名
    const publicKey = process.env.ALIPAY_ALIPAY_PUBLIC_KEY!.replace(/\\n/g, '\n');
    const isValid = verifySign({ ...params }, publicKey);
    
    if (!isValid) {
      console.error('签名验证失败');
      return res.status(400).send('fail');
    }

    const { trade_status, out_trade_no, buyer_id } = params;

    const order = orders.get(out_trade_no);
    if (!order) {
      console.error(`订单不存在: ${out_trade_no}`);
      return res.status(404).send('fail');
    }

    if (trade_status === 'TRADE_SUCCESS') {
      order.status = 'paid';
      createOrUpdateUser(order.userId, { isPro: true });
      console.log(`订单 ${out_trade_no} 支付成功，用户 ${order.userId} 已升级为 Pro，买家ID: ${buyer_id}`);
    }

    res.status(200).send('success');
  } catch (error) {
    console.error('处理回调失败:', error);
    res.status(500).send('fail');
  }
}
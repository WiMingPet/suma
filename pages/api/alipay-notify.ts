// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { orders } from './create-payment';
import { createOrUpdateUser } from '../../lib/store';

// 验证支付宝签名（纯手工实现，不依赖SDK）
function verifySign(params: Record<string, string>, publicKey: string): boolean {
  // 1. 获取并移除签名
  const sign = params.sign;
  if (!sign) return false;

  // 2. 过滤参与签名的参数（去掉sign和sign_type）
  const filteredParams: Record<string, string> = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      if (key !== 'sign' && key !== 'sign_type' && params[key]) {
        filteredParams[key] = params[key];
      }
    });

  // 3. 构建待验证字符串
  const signContent = Object.entries(filteredParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  console.log('回调签名内容:', signContent);
  console.log('回调签名:', sign);

  // 4. 使用支付宝公钥验证签名
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
    console.log('收到支付宝回调参数:', params);

    // 关键：获取支付宝公钥（从文件或环境变量）
    const publicKey = process.env.ALIPAY_ALIPAY_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
    if (!publicKey) {
      console.error('缺少支付宝公钥配置');
      return res.status(500).send('fail');
    }

    // 验证签名（这是安全核心）
    const isValid = verifySign(params, publicKey);
    if (!isValid) {
      console.error('回调签名验证失败');
      return res.status(400).send('fail');
    }

    const { trade_status, out_trade_no, buyer_id } = params;
    if (!out_trade_no) {
      console.error('回调参数中无订单号');
      return res.status(400).send('fail');
    }

    const order = orders.get(out_trade_no);
    if (!order) {
      console.error(`订单不存在: ${out_trade_no}`);
      return res.status(404).send('fail');
    }

    if (trade_status === 'TRADE_SUCCESS') {
      if (order.status !== 'paid') {
        order.status = 'paid';
        createOrUpdateUser(order.userId, { isPro: true });
        console.log(`✅ 订单 ${out_trade_no} 支付成功，用户 ${order.userId} 已升级为 Pro，买家ID: ${buyer_id}`);
      } else {
        console.log(`订单 ${out_trade_no} 已处理过，忽略重复通知`);
      }
    } else {
      console.log(`交易状态 ${trade_status} 非成功状态，暂不处理`);
    }

    // 务必返回 'success'，否则支付宝会重复通知
    res.status(200).send('success');
  } catch (error) {
    console.error('处理回调失败:', error);
    res.status(500).send('fail');
  }
}
// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fs from 'fs';
// 替换为新的数据库服务
import { getOrder, updateOrderStatus, upgradeUserToPro } from '../../lib/orderService';

// 获取支付宝公钥（从文件或环境变量）
function getAlipayPublicKey(): string {
  // 优先从文件读取
  const keyPath = process.env.ALIPAY_PUBLIC_KEY_PATH || '/app/alipay_public_key.pem';
  try {
    const key = fs.readFileSync(keyPath, 'utf-8');
    console.log('从文件读取支付宝公钥成功');
    return key;
  } catch (error) {
    console.log(`从文件读取失败: ${keyPath}`);
  }
  
  // fallback 到环境变量
  const envKey = process.env.ALIPAY_ALIPAY_PUBLIC_KEY;
  if (envKey) {
    console.log('从环境变量读取支付宝公钥');
    return envKey.replace(/\\n/g, '\n');
  }
  
  console.error('支付宝公钥未配置');
  return '';
}

// 验证支付宝签名
function verifySign(params: Record<string, string>, publicKey: string): boolean {
  const sign = params.sign;
  if (!sign) return false;

  // 过滤参数（排除 sign 和 sign_type）
  const filteredParams: Record<string, string> = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      if (key !== 'sign' && key !== 'sign_type' && params[key]) {
        filteredParams[key] = params[key];
      }
    });

  // 构建待签名字符串
  const signContent = Object.entries(filteredParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  console.log('待签名字符串:', signContent);

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

    // 获取支付宝公钥
    const alipayPublicKey = getAlipayPublicKey();
    if (!alipayPublicKey) {
      console.error('❌ 缺少支付宝公钥配置');
      return res.status(500).send('fail');
    }

    // 验证签名
    const isValid = verifySign(params, alipayPublicKey);
    if (!isValid) {
      console.error('❌ 签名验证失败');
      return res.status(400).send('fail');
    }

    console.log('✅ 签名验证成功');

    const { trade_status, out_trade_no } = params;

    if (!out_trade_no) {
      console.error('❌ 缺少订单号');
      return res.status(400).send('fail');
    }

    // 从数据库查询订单
    const order = await getOrder(out_trade_no);
    if (!order) {
      console.error(`❌ 订单不存在: ${out_trade_no}`);
      return res.status(404).send('fail');
    }

    if (trade_status === 'TRADE_SUCCESS') {
      // 检查订单状态，避免重复处理
      if (order.status !== 'paid') {
        // 更新数据库中的订单状态
        await updateOrderStatus(out_trade_no, 'paid');
        // 升级数据库中的用户会员状态
        await upgradeUserToPro(order.user_id);
        console.log(`✅ 订单 ${out_trade_no} 支付成功，用户 ${order.user_id} 已升级为 Pro`);
      } else {
        console.log(`订单 ${out_trade_no} 已处理过`);
      }
    }

    res.status(200).send('success');
  } catch (error) {
    console.error('处理回调失败:', error);
    res.status(500).send('fail');
  }
}
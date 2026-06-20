// pages/api/order-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { outTradeNo } = req.query;

  if (!outTradeNo) {
    return res.status(400).json({ error: '缺少订单号' });
  }

  try {
    // 1. 查本地数据库
    const result = await query(
      'SELECT status FROM orders WHERE out_trade_no = $1',
      [outTradeNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    let status = result.rows[0].status;

    // 2. 如果本地是 pending，主动查支付宝
    if (status === 'pending') {
      const alipayStatus = await queryAlipayOrder(outTradeNo as string);
      if (alipayStatus === 'TRADE_SUCCESS') {
        await query(
          'UPDATE orders SET status = $1 WHERE out_trade_no = $2',
          ['paid', outTradeNo]
        );
        status = 'paid';
      }
    }

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

// 调用支付宝查询接口
async function queryAlipayOrder(outTradeNo: string): Promise<string> {
  const appId = process.env.ALIPAY_APP_ID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const gateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';

  if (!appId || !privateKey) {
    console.error('支付宝配置缺失');
    return 'pending';
  }

  // 构建请求参数
  const bizContent = JSON.stringify({ out_trade_no: outTradeNo });
  const params: Record<string, string> = {
    app_id: appId,
    method: 'alipay.trade.query',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    version: '1.0',
    biz_content: bizContent,
  };

  // 生成签名
  const sortedKeys = Object.keys(params).sort();
  const signContent = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signContent);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');
  params.sign = signature;

  // 发送请求
  const formBody = new URLSearchParams(params).toString();
  const response = await fetch(gateway, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
  });

  const data = await response.json();
  console.log('支付宝查询结果:', data);

  const tradeStatus = data.alipay_trade_query_response?.trade_status;
  return tradeStatus === 'TRADE_SUCCESS' ? 'TRADE_SUCCESS' : 'pending';
}
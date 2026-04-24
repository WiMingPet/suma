// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import crypto from 'crypto';

// 临时订单存储
const orders = new Map();

// 生成签名
function generateSign(params: Record<string, any>, privateKey: string): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result: Record<string, any>, key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        result[key] = params[key];
      }
      return result;
    }, {});
  
  const signContent = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signContent);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, amount, userId } = req.body;
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/alipay-notify`;
  const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/`;

  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  try {
    const bizContent: Record<string, any> = {
      out_trade_no: outTradeNo,
      total_amount: amount,
      subject: '速码AI Pro会员',
      product_code: type === 'h5' ? 'QUICK_WAP_WAY' : undefined,
    };

    if (type === 'qrcode') {
      bizContent.product_code = 'FACE_TO_FACE_PAYMENT';
    }

    const params: Record<string, any> = {
      app_id: process.env.ALIPAY_APP_ID,
      method: type === 'qrcode' ? 'alipay.trade.precreate' : 'alipay.trade.wap.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00'),
      version: '1.0',
      notify_url: notifyUrl,
      biz_content: JSON.stringify(bizContent),
    };

    if (type === 'h5') {
      params.return_url = returnUrl;
    }

    // 生成签名
    const privateKey = process.env.ALIPAY_PRIVATE_KEY!.replace(/\\n/g, '\n');
    params.sign = generateSign(params, privateKey);

    // 构建请求
    const gateway = process.env.ALIPAY_GATEWAY!;
    
    if (type === 'qrcode') {
      // 二维码模式：调用 API 获取二维码
      const response = await axios.post(gateway, new URLSearchParams(params), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      const result = response.data;
      if (result.alipay_trade_precreate_response?.code === '10000') {
        const qrCode = result.alipay_trade_precreate_response.qr_code;
        return res.status(200).json({ success: true, qrCode, outTradeNo });
      } else {
        throw new Error(result.alipay_trade_precreate_response?.sub_msg || '创建订单失败');
      }
    } else {
      // H5 模式：生成表单直接返回
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>跳转支付宝支付...</title>
        </head>
        <body>
          <form id="alipayForm" action="${gateway}" method="POST">
            ${Object.entries(params).map(([key, value]) => `<input type="hidden" name="${key}" value="${value}"/>`).join('')}
          </form>
          <script>document.getElementById('alipayForm').submit();</script>
        </body>
        </html>
      `;
      return res.status(200).send(formHtml);
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}

export { orders };
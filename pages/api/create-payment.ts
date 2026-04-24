// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// 临时订单存储
const orders = new Map();

// 生成签名
function generateSign(params: Record<string, any>, privateKey: string): string {
  // 过滤参数
  const filteredParams: Record<string, any> = {};
  for (const key of Object.keys(params).sort()) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      filteredParams[key] = params[key];
    }
  }
  
  // 构建签名字符串
  const signContent = Object.entries(filteredParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  // RSA-SHA256 签名
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

  // 保存订单
  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  try {
    // 准备请求参数
    const bizContent: Record<string, any> = {
      out_trade_no: outTradeNo,
      total_amount: amount,
      subject: '速码AI Pro会员',
    };

    let method = 'alipay.trade.precreate';
    if (type === 'h5') {
      method = 'alipay.trade.wap.pay';
      bizContent.product_code = 'QUICK_WAP_WAY';
    } else {
      bizContent.product_code = 'FACE_TO_FACE_PAYMENT';
    }

    const params: Record<string, any> = {
      app_id: process.env.ALIPAY_APP_ID,
      method: method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      version: '1.0',
      notify_url: notifyUrl,
      biz_content: JSON.stringify(bizContent),
    };

    // 生成签名
    const privateKey = process.env.ALIPAY_PRIVATE_KEY!.replace(/\\n/g, '\n');
    params.sign = generateSign(params, privateKey);

    // 使用 Node.js 原生 fetch (Next.js 12.2+ 支持)
    const gateway = process.env.ALIPAY_GATEWAY!;
    const formBody = new URLSearchParams(params).toString();

    const response = await fetch(gateway, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const result = await response.json();

    if (type === 'qrcode') {
      // 二维码支付
      const aliResponse = result.alipay_trade_precreate_response;
      if (aliResponse?.code === '10000') {
        return res.status(200).json({
          success: true,
          qrCode: aliResponse.qr_code,
          outTradeNo,
        });
      } else {
        throw new Error(aliResponse?.sub_msg || aliResponse?.msg || '创建订单失败');
      }
    } else {
      // H5 支付：返回表单
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>跳转支付宝...</title>
        </head>
        <body>
          <form id="alipayForm" action="${gateway}" method="POST">
            ${Object.entries(params).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`).join('')}
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
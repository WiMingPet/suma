// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// 临时订单存储
const orders = new Map();

/**
 * 生成支付宝签名
 * 规则：参数按key排序，value不要encode，拼接成字符串，最后sign不参与签名
 */
function generateSign(params: Record<string, any>, privateKey: string): string {
  // 1. 过滤掉 sign 字段，value 为空的不参与
  const filtered: Record<string, any> = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      if (key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
        filtered[key] = params[key];
      }
    });

  // 2. 拼接字符串（不要 encode）
  const signContent = Object.entries(filtered)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  console.log('待签名字符串:', signContent);

  // 3. 使用私钥签名
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signContent);
  signer.end();
  const signature = signer.sign(privateKey, 'base64');

  return signature;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, amount, userId } = req.body;
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/alipay-notify`;
  const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/`;

  // 保存订单
  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  try {
    // 业务参数
    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: amount,
      subject: '速码AI Pro会员',
      product_code: type === 'h5' ? 'QUICK_WAP_WAY' : undefined,
    };

    // 公共参数（不包含 sign）
    const params: Record<string, any> = {
      app_id: process.env.ALIPAY_APP_ID!,
      method: type === 'h5' ? 'alipay.trade.wap.pay' : 'alipay.trade.precreate',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      version: '1.0',
      notify_url: notifyUrl,
      biz_content: JSON.stringify(bizContent),
    };

    // H5 支付需要 return_url
    if (type === 'h5') {
      params.return_url = returnUrl;
    }

    // 生成签名
    const privateKey = process.env.ALIPAY_PRIVATE_KEY!.replace(/\\n/g, '\n');
    params.sign = generateSign(params, privateKey);

    console.log('签名:', params.sign);
    console.log('完整参数:', params);

    const gateway = process.env.ALIPAY_GATEWAY!;

    if (type === 'h5') {
      // H5 支付：构建表单跳转
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>跳转支付宝...</title></head>
        <body>
          <form id="alipayForm" action="${gateway}" method="POST">
            ${Object.entries(params)
              .map(([key, val]) => `<input type="hidden" name="${key}" value="${String(val)}">`)
              .join('')}
          </form>
          <script>document.getElementById('alipayForm').submit();</script>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(formHtml);
    } else {
      // 二维码模式：稍后实现，先提示
      return res.status(200).json({
        success: false,
        error: '二维码模式签名复杂，请先用 H5 测试',
      });
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}

export { orders };
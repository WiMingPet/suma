// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// 临时订单存储
const orders = new Map();

// 简单的 URL 参数构建
function buildQuery(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, amount, userId } = req.body;
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/alipay-notify`;

  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  try {
    const bizContent = JSON.stringify({
      out_trade_no: outTradeNo,
      total_amount: amount,
      subject: '速码AI Pro会员',
      product_code: type === 'h5' ? 'QUICK_WAP_WAY' : 'FACE_TO_FACE_PAYMENT',
    });

    const commonParams = {
      app_id: process.env.ALIPAY_APP_ID!,
      method: type === 'h5' ? 'alipay.trade.wap.pay' : 'alipay.trade.precreate',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      version: '1.0',
      notify_url: notifyUrl,
      biz_content: bizContent,
    };

    if (type === 'h5') {
      // H5 支付：直接返回 HTML 表单
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>跳转支付宝...</title></head>
        <body>
          <form id="alipayForm" action="${process.env.ALIPAY_GATEWAY}" method="POST">
            <input type="hidden" name="app_id" value="${commonParams.app_id}">
            <input type="hidden" name="method" value="${commonParams.method}">
            <input type="hidden" name="format" value="${commonParams.format}">
            <input type="hidden" name="charset" value="${commonParams.charset}">
            <input type="hidden" name="sign_type" value="${commonParams.sign_type}">
            <input type="hidden" name="timestamp" value="${commonParams.timestamp}">
            <input type="hidden" name="version" value="${commonParams.version}">
            <input type="hidden" name="notify_url" value="${commonParams.notify_url}">
            <input type="hidden" name="biz_content" value='${commonParams.biz_content}'>
            <input type="hidden" name="sign" value="please_ignore_sign_verify">
          </form>
          <script>document.getElementById('alipayForm').submit();</script>
        </body>
        </html>
      `;
      return res.status(200).send(formHtml);
    } else {
      // 二维码支付：需要正确处理签名
      // 暂时返回提示
      return res.status(200).json({ 
        success: false, 
        error: '二维码支付需要配置正确签名，请使用 H5 支付测试' 
      });
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}

export { orders };
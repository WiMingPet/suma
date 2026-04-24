// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fs from 'fs';

// 临时订单存储
const orders = new Map();

// 检测是否为移动设备
function isMobileClient(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  return mobileKeywords.some(keyword => userAgent.toLowerCase().includes(keyword));
}

// 获取密钥
function getPrivateKey(): string {
  const keyPath = process.env.ALIPAY_PRIVATE_KEY_PATH || '/app/alipay_private_key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    return process.env.ALIPAY_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  }
}

// 生成支付宝签名
function generateSign(params: Record<string, any>, privateKey: string): string {
  const filteredParams: Record<string, any> = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      if (key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
        filteredParams[key] = params[key];
      }
    });
  
  const signContent = Object.entries(filteredParams)
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

  const appId = process.env.ALIPAY_APP_ID;
  const gateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (!appId || !baseUrl) {
    console.error('环境变量缺失:', { appId: !!appId, baseUrl: !!baseUrl });
    return res.status(500).json({ error: '配置错误' });
  }

  const privateKey = getPrivateKey();
  if (!privateKey) {
    return res.status(500).json({ error: '私钥配置错误' });
  }

  const { amount, userId, type: frontendType } = req.body;  // ← 取出前端传的 type

  // 优先使用前端传的 type，如果没有再根据 User-Agent 判断
  const userAgent = req.headers['user-agent'];
  const isMobile = isMobileClient(userAgent);
  const type = frontendType || (isMobile ? 'h5' : 'qrcode');
  
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${baseUrl}/api/alipay-notify`;
  const returnUrl = `${baseUrl}/`;

  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  try {
    if (type === 'qrcode') {
      // 电脑扫码支付
      const bizContent = {
        out_trade_no: outTradeNo,
        total_amount: amount,
        subject: '速码AI Pro会员',
        product_code: 'FACE_TO_FACE_PAYMENT',
      };
      
      // 使用 any 类型避免 TypeScript 错误
      const params: any = {
        app_id: appId,
        method: 'alipay.trade.precreate',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        version: '1.0',
        notify_url: notifyUrl,
        biz_content: JSON.stringify(bizContent),
      };
      
      params.sign = generateSign(params, privateKey);
      
      const formBody = new URLSearchParams(params).toString();
      const response = await fetch(gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });
      
      const result = await response.json();
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
      // 手机 H5 支付
      const bizContent = {
        out_trade_no: outTradeNo,
        total_amount: amount,
        subject: '速码AI Pro会员',
        product_code: 'QUICK_WAP_WAY',
      };
      
      const params: any = {
        app_id: appId,
        method: 'alipay.trade.wap.pay',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        version: '1.0',
        notify_url: notifyUrl,
        return_url: returnUrl,
        biz_content: JSON.stringify(bizContent),
      };
      
      params.sign = generateSign(params, privateKey);
      
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>跳转支付宝...</title></head>
        <body>
          <form id="alipayForm" action="${gateway}" method="POST">
            ${Object.entries(params).map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v)}">`).join('')}
          </form>
          <script>document.getElementById('alipayForm').submit();</script>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(formHtml);
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}

export { orders };
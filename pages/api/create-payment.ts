// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fs from 'fs';

// 临时订单存储
const orders = new Map();

// 获取密钥
function getPrivateKey(): string {
  const keyPath = process.env.ALIPAY_PRIVATE_KEY_PATH || '/app/alipay_private_key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    console.error(`读取私钥文件失败: ${keyPath}`);
    return process.env.ALIPAY_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  }
}

function getAlipayPublicKey(): string {
  const keyPath = process.env.ALIPAY_PUBLIC_KEY_PATH || '/app/alipay_public_key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    console.error(`读取公钥文件失败: ${keyPath}`);
    return process.env.ALIPAY_ALIPAY_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
  }
}

// 生成支付宝签名
function generateSign(params: Record<string, any>, privateKey: string): string {
  // 1. 过滤参数
  const filteredParams: Record<string, any> = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      if (key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
        filteredParams[key] = params[key];
      }
    });
  
  // 2. 构建签名字符串
  const signContent = Object.entries(filteredParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  console.log('待签名字符串:', signContent);
  
  // 3. RSA-SHA256 签名
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

  const { type, amount, userId } = req.body;
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${baseUrl}/api/alipay-notify`;
  const returnUrl = `${baseUrl}/`;

  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  // 公共参数
  const commonParams: Record<string, any> = {
    app_id: appId,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    version: '1.0',
    notify_url: notifyUrl,
  };

  try {
    if (type === 'qrcode') {
      // 电脑扫码支付
      const bizContent = {
        out_trade_no: outTradeNo,
        total_amount: amount,
        subject: '速码AI Pro会员',
        product_code: 'FACE_TO_FACE_PAYMENT',
      };
      
      const params = {
        ...commonParams,
        method: 'alipay.trade.precreate',
        biz_content: JSON.stringify(bizContent),
      };
      
      params.sign = generateSign(params, privateKey);
      
      // 发送请求
      const formBody = new URLSearchParams(params).toString();
      const response = await fetch(gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });
      
      const result = await response.json();
      const aliResponse = result.alipay_trade_precreate_response;
      
      if (aliResponse?.code === '10000') {
        return res.status(200).json({ success: true, qrCode: aliResponse.qr_code, outTradeNo });
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
      
      const params = {
        ...commonParams,
        method: 'alipay.trade.wap.pay',
        biz_content: JSON.stringify(bizContent),
        return_url: returnUrl,
      };
      
      params.sign = generateSign(params, privateKey);
      
      // 构建表单
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
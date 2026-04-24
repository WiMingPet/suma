// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

// 正确的导入方式
const AlipaySdk = require('alipay-sdk');

// 临时订单存储
const orders = new Map();

function getPrivateKey(): string {
  const keyPath = process.env.ALIPAY_PRIVATE_KEY_PATH || '/app/alipay_private_key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    console.error(`读取私钥文件失败: ${keyPath}`, error);
    return process.env.ALIPAY_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  }
}

function getAlipayPublicKey(): string {
  const keyPath = process.env.ALIPAY_PUBLIC_KEY_PATH || '/app/alipay_public_key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    console.error(`读取公钥文件失败: ${keyPath}`, error);
    return process.env.ALIPAY_ALIPAY_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.ALIPAY_APP_ID;
  const gateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (!appId || !baseUrl) {
    console.error('支付宝环境变量缺失:', { appId: !!appId, baseUrl: !!baseUrl });
    return res.status(500).json({ error: '支付服务配置错误' });
  }

  const privateKey = getPrivateKey();
  const alipayPublicKey = getAlipayPublicKey();

  if (!privateKey || !alipayPublicKey) {
    console.error('密钥读取失败');
    return res.status(500).json({ error: '支付密钥配置错误' });
  }

  // 实例化 AlipaySdk
  const alipaySdk = new AlipaySdk({
    appId: appId,
    privateKey: privateKey,
    alipayPublicKey: alipayPublicKey,
    gateway: gateway,
    signType: 'RSA2',
  });

  const { type, amount, userId } = req.body;
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${baseUrl}/api/alipay-notify`;
  const returnUrl = `${baseUrl}/`;

  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  try {
    const bizContent = {
      outTradeNo,
      totalAmount: amount,
      subject: '速码AI Pro会员',
      body: '升级成为Pro会员，享受无限次生成',
      timeoutExpress: '30m',
    };

    if (type === 'qrcode') {
      const result = await alipaySdk.exec('alipay.trade.precreate', {
        bizContent: {
          ...bizContent,
          productCode: 'FACE_TO_FACE_PAYMENT',
        },
        notifyUrl,
      });

      if (result.code === '10000') {
        return res.status(200).json({ success: true, qrCode: result.qr_code, outTradeNo });
      } else {
        throw new Error(result.sub_msg || result.msg || '创建订单失败');
      }
    } else {
      const formHtml = await alipaySdk.exec('alipay.trade.wap.pay', {
        bizContent: {
          ...bizContent,
          productCode: 'QUICK_WAP_WAY',
        },
        notifyUrl,
        returnUrl,
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(formHtml);
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}

export { orders };
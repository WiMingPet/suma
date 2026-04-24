// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// 使用 require 方式导入，避免 TypeScript 类型问题
const AlipaySdk = require('alipay-sdk').default;
const AlipayFormData = require('alipay-sdk/lib/form').default;

// 临时订单存储
const orders = new Map();

// 初始化支付宝 SDK
const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  alipayPublicKey: process.env.ALIPAY_ALIPAY_PUBLIC_KEY!.replace(/\\n/g, '\n'),
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
  signType: 'RSA2',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允许 POST 请求
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
    // 公共业务参数
    const bizContent = {
      outTradeNo,
      totalAmount: amount,
      subject: '速码AI Pro会员',
      body: '升级成为Pro会员，享受无限次生成',
      timeoutExpress: '30m',
    };

    if (type === 'qrcode') {
      // 电脑扫码支付
      const result = await alipaySdk.exec('alipay.trade.precreate', {
        bizContent: {
          ...bizContent,
          productCode: 'FACE_TO_FACE_PAYMENT',
        },
        notifyUrl,
      });

      if (result.code === '10000') {
        return res.status(200).json({
          success: true,
          qrCode: result.qr_code,
          outTradeNo,
        });
      } else {
        throw new Error(result.sub_msg || result.msg || '创建订单失败');
      }
    } else {
      // 手机 H5 支付
      const formData = new AlipayFormData();
      formData.setMethod('POST');
      formData.addField('bizContent', {
        ...bizContent,
        productCode: 'QUICK_WAP_WAY',
      });
      formData.addField('notifyUrl', notifyUrl);
      formData.addField('returnUrl', returnUrl);

      const result = await alipaySdk.exec('alipay.trade.wap.pay', {}, { formData });
      
      // 返回 HTML 表单
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(result);
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}

export { orders };
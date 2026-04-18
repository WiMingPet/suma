// pages/api/create-order.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import AlipaySdk from 'alipay-sdk';
import AlipayFormData from 'alipay-sdk/lib/form';
import { orderStore, userStore } from '../../lib/store';

const plans = {
  basic: { amount: 9.9, points: 100, name: '基础包' },
  recommended: { amount: 49.9, points: 650, name: '推荐包' },
  premium: { amount: 99.9, points: 1700, name: '超值包' },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 验证登录状态
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '请先登录' });
  }
  const token = authHeader.split(' ')[1];
  let phone: string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    phone = decoded.phone;
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }

  const { planKey } = req.body;
  const plan = plans[planKey as keyof typeof plans];
  if (!plan) {
    return res.status(400).json({ error: '无效的套餐' });
  }

  const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const order = {
    id: orderId,
    userId: phone,
    amount: plan.amount,
    points: plan.points,
    status: 'pending' as const,
    createdAt: Date.now(),
  };
  orderStore.set(orderId, order);

  // 判断是否是手机端
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);

  if (process.env.NODE_ENV === 'development') {
    // 开发环境模拟支付
    return res.status(200).json({
      success: true,
      orderId,
      isMobile,
      devMode: true,
      payUrl: `/mock-pay?orderId=${orderId}`,
    });
  }

  // 生产环境调用支付宝
  const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID!,
    privateKey: process.env.ALIPAY_PRIVATE_KEY!,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
    gateway: 'https://openapi.alipay.com/gateway.do',
  });

  const bizContent = {
    out_trade_no: orderId,
    total_amount: plan.amount.toFixed(2),
    subject: `速码AI - ${plan.name}`,
    body: `充值${plan.points}点算力`,
    product_code: isMobile ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY',
  };

  const formData = new AlipayFormData();
  formData.setMethod('get');
  formData.addField('returnUrl', `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success`);
  formData.addField('notifyUrl', `${process.env.NEXT_PUBLIC_SITE_URL}/api/alipay-notify`);
  formData.addField('bizContent', bizContent);

  const result = await alipaySdk.exec(
    isMobile ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay',
    {},
    { formData }
  );

  res.status(200).json({
    success: true,
    orderId,
    isMobile,
    payUrl: result,
  });
}
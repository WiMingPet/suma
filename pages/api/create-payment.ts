// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as AlipaySdk from 'alipay-sdk';
import AlipayFormData from 'alipay-sdk/lib/form';

const AlipaySdkClass = (AlipaySdk as any).default || AlipaySdk;

const alipaySdk = new AlipaySdkClass({
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!,
  alipayPublicKey: process.env.ALIPAY_ALIPAY_PUBLIC_KEY!,
  gateway: process.env.ALIPAY_GATEWAY!,
});

// 临时订单存储
const orders = new Map();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, amount, userId } = req.body;
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;

  orders.set(outTradeNo, { userId, amount, status: 'pending', createdAt: Date.now() });

  try {
    const formData = new AlipayFormData();
    formData.setMethod('GET');

    const bizContent = {
      outTradeNo,
      totalAmount: amount,
      subject: '速码AI Pro会员',
      productCode: type === 'h5' ? 'QUICK_WAP_WAY' : undefined,
      notifyUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/alipay-notify`,
    };

    formData.addField('bizContent', bizContent);

    let method = 'alipay.trade.precreate';
    if (type === 'h5') method = 'alipay.trade.wap.pay';

    const result = await alipaySdk.exec(method, {}, { formData });

    if (type === 'qrcode') {
      return res.status(200).json({ success: true, qrCode: result.qr_code, outTradeNo });
    } else {
      return res.status(200).send(result);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建订单失败' });
  }
}

export { orders };
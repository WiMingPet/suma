// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// 动态导入 alipay-sdk
let AlipaySdk: any;
async function getAlipaySdk() {
  if (!AlipaySdk) {
    const module = await import('alipay-sdk');
    AlipaySdk = module.default;
  }
  return AlipaySdk;
}

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
    const AlipaySdkClass = await getAlipaySdk();
    const alipaySdk = new AlipaySdkClass({
      appId: process.env.ALIPAY_APP_ID!,
      privateKey: process.env.ALIPAY_PRIVATE_KEY!,
      alipayPublicKey: process.env.ALIPAY_ALIPAY_PUBLIC_KEY!,
      gateway: process.env.ALIPAY_GATEWAY!,
    });

    const bizContent = {
      outTradeNo,
      totalAmount: amount,
      subject: '速码AI Pro会员',
      productCode: type === 'h5' ? 'QUICK_WAP_WAY' : undefined,
      notifyUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/alipay-notify`,
      timeoutExpress: '30m',
    };

    let method = 'alipay.trade.precreate';
    if (type === 'h5') method = 'alipay.trade.wap.pay';

    // 构建请求参数
    const result = await alipaySdk.exec(method, {
      bizContent: JSON.stringify(bizContent),
    });

    if (type === 'qrcode') {
      return res.status(200).json({ success: true, qrCode: result.qr_code, outTradeNo });
    } else {
      // H5 支付需要返回表单
      const formHtml = alipaySdk.getPageResult(result);
      return res.status(200).send(formHtml);
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}

export { orders };
// pages/api/alipay-notify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySign, getAlipayKeys } from '../../lib/alipay';
import { handlePaymentSuccess } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).send('fail');
  }

  try {
    // 2. 解析参数（支付宝POST的是form格式）
    let params = req.body;
    
    // 如果body是字符串，手动解析
    if (typeof params === 'string') {
      const searchParams = new URLSearchParams(params);
      params = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }
    
    console.log('📥 收到支付宝回调:', {
      trade_status: params.trade_status,
      out_trade_no: params.out_trade_no,
      total_amount: params.total_amount,
    });

    // 3. 验证必要参数
    if (!params.out_trade_no || !params.trade_status) {
      console.error('❌ 缺少必要参数');
      return res.status(400).send('fail');
    }

    // 4. 验证签名
    const { publicKey, isValid } = getAlipayKeys();
    
    if (!isValid) {
      console.error('❌ 支付宝配置无效，无法验签');
      return res.status(500).send('fail');
    }

    const isSignValid = verifySign(params, publicKey);
    if (!isSignValid) {
      console.error('❌ 签名验证失败');
      return res.status(400).send('fail');
    }

    console.log('✅ 签名验证通过');

    // 5. 处理交易状态
    const { trade_status, out_trade_no, total_amount } = params;

    // 只处理交易成功的通知
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      console.log(`🔄 开始处理订单: ${out_trade_no}`);
      
      const result = await handlePaymentSuccess(out_trade_no, total_amount);
      
      if (result.success) {
        console.log(`✅ 订单处理成功: ${out_trade_no}, 用户: ${result.userId}`);
      } else {
        console.log(`⚠️ ${result.message}`);
      }
    } else {
      console.log(`ℹ️ 交易状态未完成: ${trade_status}`);
    }

    // 6. 返回success（支付宝要求返回success才停止通知）
    return res.status(200).send('success');
    
  } catch (error) {
    console.error('❌ 处理回调异常:', error);
    return res.status(500).send('fail');
  }
}
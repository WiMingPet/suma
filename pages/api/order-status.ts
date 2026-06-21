// pages/api/order-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { queryAlipayOrder } from '../../lib/alipay';
import { handlePaymentSuccess, forceUpdateOrderPaid } from '../../lib/orderService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { outTradeNo, force } = req.query;

  if (!outTradeNo) {
    return res.status(400).json({ error: '缺少订单号' });
  }

  try {
    // 强制更新模式（手动确认按钮）
    if (force === 'paid') {
      const result = await forceUpdateOrderPaid(outTradeNo as string);
      
      return res.status(200).json({
        success: result.success,
        status: result.success ? 'paid' : 'pending',
        isPaid: result.success,
        message: result.message,
      });
    }

    // 正常查询模式
    // 1. 查询本地数据库
    const result = await query(
      'SELECT status FROM orders WHERE out_trade_no = $1',
      [outTradeNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    let status = result.rows[0].status;

    // 2. 如果本地是pending，主动查询支付宝
    if (status === 'pending') {
      console.log(`🔍 主动查询支付宝订单: ${outTradeNo}`);
      const alipayStatus = await queryAlipayOrder(outTradeNo as string);
      
      if (alipayStatus === 'TRADE_SUCCESS' || alipayStatus === 'TRADE_FINISHED') {
        // 支付成功，使用事务处理
        const payResult = await handlePaymentSuccess(outTradeNo as string);
        
        if (payResult.success) {
          status = 'paid';
          console.log(`✅ 主动查询并处理成功: ${outTradeNo}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      status: status,
      isPaid: status === 'paid',
    });
    
  } catch (error) {
    console.error('查询订单状态失败:', error);
    return res.status(500).json({ error: '查询失败' });
  }
}
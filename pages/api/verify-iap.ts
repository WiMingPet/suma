// pages/api/verify-iap.ts
// Apple IAP 收据验证接口

import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

// Apple 收据验证 URL
const APPLE_VERIFY_URL = process.env.NODE_ENV === 'production'
  ? 'https://buy.itunes.apple.com/verifyReceipt'
  : 'https://sandbox.itunes.apple.com/verifyReceipt';

// 套餐配置
const PLAN_CONFIG = {
  month: { points: 500, price: '29.9', days: 30 },
  season: { points: 1500, price: '69.9', days: 90 },
  year: { points: 5000, price: '199', days: 365 },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { receipt, transactionId, plan, amount, points } = req.body;
  
  // 获取用户 ID（从请求头或 token 中获取）
  const userId = req.headers.userid as string || req.headers['x-user-id'] as string;
  
  // 参数校验
  if (!receipt || !transactionId) {
    return res.status(400).json({ success: false, message: '缺少收据信息' });
  }
  
  if (!userId) {
    return res.status(401).json({ success: false, message: '用户未登录' });
  }

  try {
    // 1. 检查订单是否已处理（防止重复）
    const existingOrder = await query(
      'SELECT id FROM orders WHERE out_trade_no = $1',
      [transactionId]
    );
    
    // ✅ 修复：QueryResult 需要访问 .rows 属性
    if (existingOrder && existingOrder.rows && existingOrder.rows.length > 0) {
      return res.status(200).json({ success: true, message: '订单已处理' });
    }

    // 2. 验证收据（调用 Apple 服务器）
    const appleResponse = await fetch(APPLE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receipt,
        'password': process.env.APPLE_SHARED_SECRET || '',
        'exclude-old-transactions': true,
      }),
    });

    const appleData = await appleResponse.json();

    // 收据无效
    if (appleData.status !== 0) {
      console.error('Apple receipt invalid, status:', appleData.status);
      
      // status 21007 表示这是沙箱收据但用了生产环境 URL
      if (appleData.status === 21007 && process.env.NODE_ENV === 'production') {
        // 重试沙箱环境
        const sandboxResponse = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'receipt-data': receipt,
            'password': process.env.APPLE_SHARED_SECRET || '',
            'exclude-old-transactions': true,
          }),
        });
        const sandboxData = await sandboxResponse.json();
        
        if (sandboxData.status !== 0) {
          return res.status(400).json({ success: false, message: '收据验证失败' });
        }
        // 使用沙箱验证结果继续
        return await processReceipt(sandboxData, userId, transactionId, plan, res);
      }
      
      return res.status(400).json({ success: false, message: '收据验证失败' });
    }

    // 3. 处理收据，发放权益
    return await processReceipt(appleData, userId, transactionId, plan, res);
    
  } catch (error) {
    console.error('IAP verify error:', error);
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 处理收据，发放权益
async function processReceipt(
  appleData: any,
  userId: string,
  transactionId: string,
  plan: string,
  res: NextApiResponse
) {
  // 获取最新交易信息
  const latestReceipt = appleData.receipt?.in_app?.[0] || appleData.latest_receipt_info?.[0];
  
  if (!latestReceipt) {
    return res.status(400).json({ success: false, message: '未找到交易信息' });
  }

  const productId = latestReceipt.product_id;
  const expiresDateMs = latestReceipt.expires_date_ms;
  
  // 根据产品 ID 或传入的 plan 确定套餐
  let planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
  
  // 如果没有传入 plan，从 productId 推断
  if (!planConfig) {
    if (productId?.includes('monthly')) planConfig = PLAN_CONFIG.month;
    else if (productId?.includes('seasonal')) planConfig = PLAN_CONFIG.season;
    else if (productId?.includes('yearly')) planConfig = PLAN_CONFIG.year;
    else {
      return res.status(400).json({ success: false, message: '未知产品类型' });
    }
  }

  // 增加用户点币
  await query(
    `INSERT INTO user_points (user_id, points) 
     VALUES ($1, $2) 
     ON CONFLICT (user_id) DO UPDATE SET points = user_points.points + $2`,
    [userId, planConfig.points]
  );

  // 更新会员状态
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + planConfig.days);

  await query(
    `INSERT INTO user_pro (user_id, is_pro, pro_expire_at) 
     VALUES ($1, true, $2) 
     ON CONFLICT (user_id) DO UPDATE SET is_pro = true, pro_expire_at = $2`,
    [userId, expireDate]
  );

  // 记录订单
  await query(
    `INSERT INTO orders (out_trade_no, user_id, amount, status, plan, platform)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [transactionId, userId, planConfig.price, 'paid', plan, 'ios_iap']
  );

  return res.status(200).json({ success: true, message: '购买成功' });
}
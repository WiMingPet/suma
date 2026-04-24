// lib/orderService.ts
import { query } from './db';

export async function createOrder(outTradeNo: string, userId: string, amount: string) {
  const result = await query(
    `INSERT INTO orders (out_trade_no, user_id, amount, status) 
     VALUES ($1, $2, $3, 'pending') 
     ON CONFLICT (out_trade_no) DO NOTHING 
     RETURNING *`,
    [outTradeNo, userId, amount]
  );
  return result.rows[0];
}

export async function updateOrderStatus(outTradeNo: string, status: string) {
  const result = await query(
    `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE out_trade_no = $2 RETURNING *`,
    [status, outTradeNo]
  );
  return result.rows[0];
}

export async function getOrder(outTradeNo: string) {
  const result = await query(`SELECT * FROM orders WHERE out_trade_no = $1`, [outTradeNo]);
  return result.rows[0];
}

export async function upgradeUserToPro(userId: string) {
  const result = await query(
    `INSERT INTO user_pro (user_id, is_pro, pro_expire) 
     VALUES ($1, TRUE, NOW() + INTERVAL '30 days') 
     ON CONFLICT (user_id) 
     DO UPDATE SET is_pro = TRUE, pro_expire = NOW() + INTERVAL '30 days', updated_at = CURRENT_TIMESTAMP 
     RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

export async function isUserPro(userId: string): Promise<boolean> {
  const result = await query(`SELECT is_pro FROM user_pro WHERE user_id = $1`, [userId]);
  return result.rows[0]?.is_pro || false;
}
// lib/orderService.ts
import { query, pool } from './db';

export async function createOrder(outTradeNo: string, userId: string, amount: string, plan?: string) {
  const result = await query(
    `INSERT INTO orders (out_trade_no, user_id, amount, status, plan) 
     VALUES ($1, $2, $3, 'pending', $4) 
     ON CONFLICT (out_trade_no) DO NOTHING 
     RETURNING *`,
    [outTradeNo, userId, amount, plan || null]
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

// 获取用户已使用的免费次数
export async function getFreeUsed(userId: string): Promise<number> {
  const result = await query(`SELECT free_used FROM user_pro WHERE user_id = $1`, [userId]);
  return result.rows[0]?.free_used || 0;
}

// 增加免费次数（每次生成后调用）
export async function incrementFreeUsed(userId: string): Promise<void> {
  await query(
    `INSERT INTO user_pro (user_id, free_used, is_pro) 
     VALUES ($1, 1, false) 
     ON CONFLICT (user_id) 
     DO UPDATE SET free_used = user_pro.free_used + 1`,
    [userId]
  );
}


// ========== 点币管理函数 ==========

// 获取用户点币
export async function getUserPoints(userId: string): Promise<number> {
  const result = await query(`SELECT points FROM user_points WHERE user_id = $1`, [userId]);
  return result.rows[0]?.points || 0;
}

// 增加点币
export async function addPoints(userId: string, points: number): Promise<void> {
  await query(
    `INSERT INTO user_points (user_id, points) VALUES ($1, $2)
     ON CONFLICT (user_id) 
     DO UPDATE SET points = user_points.points + $2`,
    [userId, points]
  );
}

// 扣减点币
export async function deductPoints(userId: string, points: number): Promise<void> {
  const currentPoints = await getUserPoints(userId);
  if (currentPoints < points) {
    throw new Error(`点币不足: 需要 ${points}，当前 ${currentPoints}`);
  }
  await query(`UPDATE user_points SET points = points - $1 WHERE user_id = $2`, [points, userId]);
}
// ========== 用户管理函数（数据库持久化）==========

// 从数据库获取用户完整信息
export async function getUserFromDB(userId: string) {
  const result = await query(
    `SELECT user_id, is_pro, free_used FROM user_pro WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// 从数据库创建新用户
export async function createUserInDB(userId: string) {
  const result = await query(
    `INSERT INTO user_pro (user_id, is_pro, free_used) 
     VALUES ($1, false, 0) 
     ON CONFLICT (user_id) DO NOTHING 
     RETURNING *`,
    [userId]
  );
  return result.rows[0] || { user_id: userId, is_pro: false, free_used: 0 };
}

// 获取或创建用户（数据库版本）
export async function getOrCreateUserInDB(userId: string) {
  let user = await getUserFromDB(userId);
  if (!user) {
    user = await createUserInDB(userId);
  }
  return user;
}

// 更新用户 Pro 状态
export async function updateUserProStatus(userId: string, isPro: boolean) {
  await query(
    `UPDATE user_pro SET is_pro = $1 WHERE user_id = $2`,
    [isPro, userId]
  );
}

// ========== 密码哈希管理 ==========

// 获取用户密码哈希
export async function getPasswordHash(userId: string): Promise<string | null> {
  const result = await query(`SELECT password_hash FROM user_pro WHERE user_id = $1`, [userId]);
  return result.rows[0]?.password_hash || null;
}

// 设置用户密码哈希
export async function setPasswordHash(userId: string, passwordHash: string): Promise<void> {
  await query(
    `INSERT INTO user_pro (user_id, password_hash) 
     VALUES ($1, $2) 
     ON CONFLICT (user_id) 
     DO UPDATE SET password_hash = $2`,
    [userId, passwordHash]
  );
}

// ========== 支付成功统一处理（事务保护）==========

/**
 * 处理支付成功（事务保护）
 * 确保订单更新、会员升级、点币增加要么全部成功，要么全部回滚
 */
export async function handlePaymentSuccess(outTradeNo: string, paidAmount?: string) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. 锁定并查询订单（FOR UPDATE防止并发问题）
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE out_trade_no = $1 FOR UPDATE',
      [outTradeNo]
    );
    
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`订单不存在: ${outTradeNo}`);
      return { success: false, message: '订单不存在' };
    }
    
    const order = orderResult.rows[0];
    
    // 2. 检查订单状态（防止重复处理）
    if (order.status === 'paid') {
      await client.query('ROLLBACK');
      console.log(`订单已处理过: ${outTradeNo}`);
      return { success: false, message: '订单已处理', userId: order.user_id };
    }
    
    // 3. 验证金额（如果提供了实际支付金额）
    if (paidAmount) {
      const notifyAmount = parseFloat(paidAmount);
      const orderAmount = parseFloat(order.amount);
      if (Math.abs(notifyAmount - orderAmount) > 0.01) {
        await client.query('ROLLBACK');
        console.error(`金额不匹配: 通知${notifyAmount}, 订单${orderAmount}`);
        return { success: false, message: '金额不匹配' };
      }
    }
    
    // 4. 更新订单状态为paid
    await client.query(
      `UPDATE orders 
       SET status = 'paid', updated_at = CURRENT_TIMESTAMP 
       WHERE out_trade_no = $1`,
      [outTradeNo]
    );
    
    // 5. 升级用户为Pro会员（根据套餐设置过期时间）
    const planDurations: Record<string, string> = {
      month: "NOW() + INTERVAL '30 days'",
      season: "NOW() + INTERVAL '90 days'",
      year: "NOW() + INTERVAL '365 days'",
    };
    
    const duration = planDurations[order.plan] || planDurations.month;
    
    await client.query(
      `INSERT INTO user_pro (user_id, is_pro, pro_expire) 
       VALUES ($1, TRUE, ${duration}) 
       ON CONFLICT (user_id) 
       DO UPDATE SET is_pro = TRUE, pro_expire = ${duration}, updated_at = CURRENT_TIMESTAMP`,
      [order.user_id]
    );
    
    // 6. 计算并添加点币
    const planPoints: Record<string, number> = {
      month: 500,
      season: 1500,
      year: 5000,
    };
    
    const pointsToAdd = planPoints[order.plan] || 0;
    
    if (pointsToAdd > 0) {
      await client.query(
        `INSERT INTO user_points (user_id, points) VALUES ($1, $2)
         ON CONFLICT (user_id) 
         DO UPDATE SET points = user_points.points + $2`,
        [order.user_id, pointsToAdd]
      );
      
      console.log(`✅ 添加点币: 用户${order.user_id}, +${pointsToAdd}`);
    }
    
    // 7. 提交事务
    await client.query('COMMIT');
    
    console.log(`✅ 支付处理完成: 订单${outTradeNo}, 用户${order.user_id}, 套餐${order.plan}`);
    
    return { 
      success: true, 
      message: '支付处理成功',
      userId: order.user_id,
      plan: order.plan,
      points: pointsToAdd,
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('支付事务处理失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 强制更新订单为已支付（手动确认使用）
 */
export async function forceUpdateOrderPaid(outTradeNo: string) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 查询订单
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE out_trade_no = $1 FOR UPDATE',
      [outTradeNo]
    );
    
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: '订单不存在' };
    }
    
    const order = orderResult.rows[0];
    
    if (order.status === 'paid') {
      await client.query('ROLLBACK');
      return { success: false, message: '订单已处理' };
    }
    
    // 更新订单状态
    await client.query(
      `UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE out_trade_no = $1`,
      [outTradeNo]
    );
    
    // 升级会员
    const planDurations: Record<string, string> = {
      month: "NOW() + INTERVAL '30 days'",
      season: "NOW() + INTERVAL '90 days'",
      year: "NOW() + INTERVAL '365 days'",
    };
    
    const duration = planDurations[order.plan] || planDurations.month;
    
    await client.query(
      `INSERT INTO user_pro (user_id, is_pro, pro_expire) 
       VALUES ($1, TRUE, ${duration}) 
       ON CONFLICT (user_id) 
       DO UPDATE SET is_pro = TRUE, pro_expire = ${duration}, updated_at = CURRENT_TIMESTAMP`,
      [order.user_id]
    );
    
    // 添加点币
    const planPoints: Record<string, number> = {
      month: 500,
      season: 1500,
      year: 5000,
    };
    
    const pointsToAdd = planPoints[order.plan] || 0;
    
    if (pointsToAdd > 0) {
      await client.query(
        `INSERT INTO user_points (user_id, points) VALUES ($1, $2)
         ON CONFLICT (user_id) 
         DO UPDATE SET points = user_points.points + $2`,
        [order.user_id, pointsToAdd]
      );
    }
    
    await client.query('COMMIT');
    
    return { 
      success: true, 
      message: '手动确认成功',
      userId: order.user_id,
      plan: order.plan,
      points: pointsToAdd,
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('强制更新失败:', error);
    throw error;
  } finally {
    client.release();
  }
}
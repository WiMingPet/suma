// lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,  // Zeabur 内置 PostgreSQL 不支持 SSL
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('执行查询:', { text, duration, rows: res.rowCount });
  return res;
}

// 创建订单表（如果不存在）
export async function initDatabase() {
  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      out_trade_no VARCHAR(100) UNIQUE NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      amount VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createUserProTable = `
    CREATE TABLE IF NOT EXISTS user_pro (
      user_id VARCHAR(50) PRIMARY KEY,
      is_pro BOOLEAN DEFAULT FALSE,
      pro_expire TIMESTAMP,
      free_used INT DEFAULT 0,        -- 已使用的免费次数
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPointsTable = `
    CREATE TABLE IF NOT EXISTS user_points (
      user_id VARCHAR(50) PRIMARY KEY,
      points INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await query(createPointsTable);
  await query(createOrdersTable);
  await query(createUserProTable);
  
  // 迁移：添加 plan 字段
  try {
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan VARCHAR(20)`);
    console.log('数据库迁移完成：orders 表添加 plan 字段');
  } catch (err) {
    console.log('迁移 plan 字段失败:', err);
  }

  console.log('数据库表初始化完成');
}

// 初始化数据库
initDatabase().catch(console.error);

export default pool;
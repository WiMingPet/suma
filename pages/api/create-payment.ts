// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fs from 'fs';
import { createOrder } from '../../lib/orderService';
import { generateSign } from '../../lib/alipay';

// 检测是否为移动设备
function isMobileClient(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  return mobileKeywords.some(keyword => userAgent.toLowerCase().includes(keyword));
}

// 获取私钥
function getPrivateKey(): string {
  const keyPath = process.env.ALIPAY_PRIVATE_KEY_PATH || '/app/alipay_private_key.pem';
  try {
    const key = fs.readFileSync(keyPath, 'utf-8');
    console.log('[私钥] 从文件读取成功');
    return key;
  } catch (error) {
    console.log('[私钥] 从文件读取失败，尝试从环境变量读取');
    const envKey = process.env.ALIPAY_PRIVATE_KEY;
    if (envKey) {
      return envKey.replace(/\\n/g, '\n');
    }
    console.error('[私钥] 私钥未找到');
    return '';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[请求] 接收到的 body:', req.body);
  console.log('[请求] 前端传的 type:', req.body.type);
  console.log('[请求] User-Agent:', req.headers['user-agent']);

  const appId = process.env.ALIPAY_APP_ID;
  const gateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (!appId || !baseUrl) {
    console.error('环境变量缺失:', { appId: !!appId, baseUrl: !!baseUrl });
    return res.status(500).json({ error: '配置错误' });
  }

  const privateKey = getPrivateKey();
  if (!privateKey) {
    return res.status(500).json({ error: '私钥配置错误' });
  }

  const { amount, userId, type: frontendType, plan } = req.body;
  
  // 优先使用前端传的 type
  const userAgent = req.headers['user-agent'];
  const isMobile = isMobileClient(userAgent);
  const type = frontendType || (isMobile ? 'h5' : 'qrcode');

  console.log('[请求] frontendType:', frontendType);
  console.log('[请求] isMobile:', isMobile);
  console.log('[请求] 最终 type:', type);
  
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${baseUrl}/api/alipay-notify`;
  const returnUrl = `${baseUrl}/payment-result`;

  // 套餐名称映射
  const planNames: Record<string, string> = { month: '月卡', season: '季卡', year: '年卡' };
  const planName = plan && planNames[plan] ? planNames[plan] : 'Pro会员';

  // 保存订单到数据库
  try {
    await createOrder(outTradeNo, userId, amount, plan);
    console.log('[订单] 数据库订单已创建:', outTradeNo);
  } catch (error) {
    console.error('[订单] 创建数据库订单失败:', error);
    return res.status(500).json({ error: '创建订单失败' });
  }

  try {
    if (type === 'qrcode') {
      // ========== 电脑扫码支付 ==========
      const bizContent = {
        out_trade_no: outTradeNo,
        total_amount: amount,
        subject: `速码方舟AI软件 ${planName}`,
        product_code: 'FACE_TO_FACE_PAYMENT',
      };

      const params: Record<string, string> = {
        app_id: appId,
        method: 'alipay.trade.precreate',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        version: '1.0',
        notify_url: notifyUrl,
        biz_content: JSON.stringify(bizContent),
      };
      
      // 使用统一的签名函数
      params.sign = generateSign(params, privateKey);
      
      const formBody = new URLSearchParams(params).toString();
      const response = await fetch(gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });
      
      const result = await response.json();
      console.log('[扫码支付] 支付宝响应:', JSON.stringify(result).substring(0, 300));
      
      const aliResponse = result.alipay_trade_precreate_response;
      
      if (aliResponse?.code === '10000') {
        console.log('[扫码支付] 订单创建成功:', outTradeNo);
        return res.status(200).json({ 
          success: true, 
          qrCode: aliResponse.qr_code, 
          outTradeNo,
        });
      } else {
        console.error('[扫码支付] 创建失败:', aliResponse?.sub_msg || aliResponse?.msg);
        throw new Error(aliResponse?.sub_msg || aliResponse?.msg || '创建订单失败');
      }
    } else {
      // ========== 手机 H5 支付 ==========
      console.log('[手机支付] 进入手机支付分支');
      
      const bizContent = {
        out_trade_no: outTradeNo,
        total_amount: amount,
        subject: `速码方舟AI软件 ${planName}`,
        product_code: 'QUICK_WAP_WAY',
      };

      const params: Record<string, string> = {
        app_id: appId,
        method: 'alipay.trade.wap.pay',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        version: '1.0',
        notify_url: notifyUrl,
        biz_content: JSON.stringify(bizContent),
      };
      
      // 使用统一的签名函数
      params.sign = generateSign(params, privateKey);
      
      // 构建完整支付 URL
      const payUrl = `${gateway}?${new URLSearchParams(params).toString()}`;
      console.log('[手机支付] 支付 URL 长度:', payUrl.length);
      
      return res.status(200).json({ success: true, payUrl });
    }
  } catch (error) {
    console.error('[支付] 创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}
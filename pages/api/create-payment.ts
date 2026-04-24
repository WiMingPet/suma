// pages/api/create-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fs from 'fs';
import { createOrder } from '../../lib/orderService';


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

// 生成签名（与 alipay-notify.ts 的验证逻辑对应）
function generateSign(params: Record<string, any>, privateKey: string): string {
  // 过滤参数：排除 sign，排除空值，按 key 排序
  const filteredParams: Record<string, string> = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      const value = params[key];
      if (key !== 'sign' && value !== undefined && value !== null && value !== '') {
        filteredParams[key] = String(value);
      }
    });
  
  // 构建待签名字符串
  const signContent = Object.entries(filteredParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  console.log('[生成签名] 待签名字符串:', signContent);
  console.log('[生成签名] 字符串长度:', signContent.length);
  
  // 签名
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signContent);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');
  
  console.log('[生成签名] 签名结果:', signature.substring(0, 50) + '...');
  return signature;
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

  // ========== 添加调试日志 ==========
  console.log('[请求] frontendType:', frontendType);
  console.log('[请求] isMobile:', isMobile);
  console.log('[请求] 最终 type:', type);
  
  const outTradeNo = `ORDER_${Date.now()}_${userId}`;
  const notifyUrl = `${baseUrl}/api/alipay-notify`;
  const returnUrl = `${baseUrl}/payment-result`;

  // 保存订单到数据库
  await createOrder(outTradeNo, userId, amount, plan);

  try {
  // 套餐名称映射
  const planNames: Record<string, string> = { month: '月卡', season: '季卡', year: '年卡' };
  const planName = plan && planNames[plan] ? planNames[plan] : 'Pro会员';
  
  const bizContent = {
    out_trade_no: outTradeNo,
    total_amount: amount,
    subject: `速码AI ${planName}`,
  };

    if (type === 'qrcode') {
      // 电脑扫码支付
      const params: any = {
        app_id: appId,
        method: 'alipay.trade.precreate',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        version: '1.0',
        notify_url: notifyUrl,
        biz_content: JSON.stringify({
          ...bizContent,
          product_code: 'FACE_TO_FACE_PAYMENT',
        }),
      };
      
      params.sign = generateSign(params, privateKey);
      
      const formBody = new URLSearchParams(params).toString();
      const response = await fetch(gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });
      
      const result = await response.json();
      const aliResponse = result.alipay_trade_precreate_response;
      
      if (aliResponse?.code === '10000') {
        return res.status(200).json({ 
          success: true, 
          qrCode: aliResponse.qr_code, 
          outTradeNo,
        });
      } else {
        throw new Error(aliResponse?.sub_msg || aliResponse?.msg || '创建订单失败');
      }
    } else {
      console.log('[手机支付] 进入手机支付分支');
      
      const bizContent = {
        out_trade_no: outTradeNo,
        total_amount: amount,
        subject: '速码AI Pro会员',
        product_code: 'QUICK_WAP_WAY',
      };

      const params: any = {
        app_id: appId,
        method: 'alipay.trade.wap.pay',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        version: '1.0',
        notify_url: notifyUrl,
        return_url: 'https://sumaai.cn/payment/result',
        biz_content: JSON.stringify(bizContent),
      };
      
      // 生成签名
      const sortedParams = Object.keys(params).sort().reduce((obj: any, key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          obj[key] = params[key];
        }
        return obj;
      }, {});
      const signContent = Object.entries(sortedParams)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signContent);
      sign.end();
      const signature = sign.sign(privateKey, 'base64');
      params.sign = signature;
      
      // 构建完整支付 URL
      const payUrl = `${gateway}?${new URLSearchParams(params).toString()}`;
      console.log('[手机支付] 支付 URL 长度:', payUrl.length);
      
      // 返回 JSON，让前端跳转
      return res.status(200).json({ success: true, payUrl });
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败: ' + (error as Error).message });
  }
}


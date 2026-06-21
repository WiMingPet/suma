// lib/alipay.ts - 支付宝工具（Zeabur文件挂载版本）
import crypto from 'crypto';
import fs from 'fs';

/**
 * 从文件或环境变量读取密钥（Zeabur兼容）
 */
function readKeyFromFileOrEnv(filePath: string, envVarName: string): string {
  // 1. 优先从文件读取（Zeabur文件挂载）
  try {
    if (filePath && fs.existsSync(filePath)) {
      const key = fs.readFileSync(filePath, 'utf-8').trim();
      console.log(`✅ 从文件读取密钥成功: ${filePath}`);
      // 验证格式
      if (key.includes('BEGIN') && key.includes('END')) {
        return key;
      } else {
        console.error(`❌ 文件内容格式错误: ${filePath}`);
      }
    }
  } catch (error: any) {
    console.log(`⚠️ 文件读取失败: ${filePath}, ${error.message}`);
  }

  // 2. Fallback到环境变量
  const envValue = process.env[envVarName];
  if (envValue) {
    // 处理环境变量中的\n转义
    const formattedKey = envValue.replace(/\\n/g, '\n');
    if (formattedKey.includes('BEGIN') && formattedKey.includes('END')) {
      console.log(`✅ 从环境变量读取密钥成功: ${envVarName}`);
      return formattedKey;
    }
  }

  console.error(`❌ 无法获取密钥: ${filePath} 或 ${envVarName}`);
  return '';
}

/**
 * 获取支付宝密钥配置
 */
export function getAlipayKeys() {
  const privateKeyPath = process.env.ALIPAY_PRIVATE_KEY_PATH || '/app/alipay_private_key.pem';
  const publicKeyPath = process.env.ALIPAY_PUBLIC_KEY_PATH || '/app/alipay_public_key.pem';

  console.log('密钥文件路径:', { privateKeyPath, publicKeyPath });

  const privateKey = readKeyFromFileOrEnv(privateKeyPath, 'ALIPAY_PRIVATE_KEY');
  const publicKey = readKeyFromFileOrEnv(publicKeyPath, 'ALIPAY_ALIPAY_PUBLIC_KEY');

  const errors: string[] = [];
  
  if (!privateKey) errors.push('无法读取应用私钥');
  if (!publicKey) errors.push('无法读取支付宝公钥');
  if (!process.env.ALIPAY_APP_ID) errors.push('缺少 ALIPAY_APP_ID');

  const config = {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey,
    publicKey,
    privateKeyPath,
    publicKeyPath,
    isValid: errors.length === 0,
    errors,
  };

  // 输出配置状态（脱敏）
  console.log('支付宝配置状态:', {
    appId: config.appId ? config.appId.substring(0, 4) + '***' : '未设置',
    hasPrivateKey: !!privateKey,
    hasPublicKey: !!publicKey,
    privateKeyLines: privateKey ? privateKey.split('\n').length : 0,
    publicKeyLines: publicKey ? publicKey.split('\n').length : 0,
    errors,
  });

  return config;
}

/**
 * 生成支付宝签名（RSA2）
 */
export function generateSign(params: Record<string, string>, privateKeyPem: string): string {
  try {
    // 1. 参数排序并构建签名原串
    const sortedKeys = Object.keys(params).sort();
    const signContent = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    console.log('签名原串:', signContent.substring(0, 100) + '...');
    
    // 2. 创建私钥对象
    let privateKey;
    try {
      privateKey = crypto.createPrivateKey({
        key: privateKeyPem,
        format: 'pem',
        type: 'pkcs8',
      });
    } catch {
      privateKey = crypto.createPrivateKey({
        key: privateKeyPem,
        format: 'pem',
        type: 'pkcs1',
      });
    }
    
    // 3. 签名
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signContent);
    sign.end();
    
    return sign.sign(privateKey, 'base64');
  } catch (error: any) {
    console.error('签名生成失败:', error.message);
    console.error('私钥前50字符:', privateKeyPem.substring(0, 50));
    throw new Error(`签名生成失败: ${error.message}`);
  }
}

/**
 * 验证支付宝回调签名
 */
export function verifySign(params: Record<string, string>, publicKeyPem: string): boolean {
  try {
    const sign = params.sign;
    if (!sign) {
      console.error('缺少sign参数');
      return false;
    }

    // 1. 过滤并排序参数
    const filteredParams: Record<string, string> = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        if (key !== 'sign' && key !== 'sign_type' && params[key]) {
          filteredParams[key] = params[key];
        }
      });

    // 2. 构建验签原串
    const signContent = Object.entries(filteredParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    console.log('验签原串:', signContent.substring(0, 100) + '...');

    // 3. 创建公钥对象
    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem',
      type: 'spki',
    });

    // 4. 验证
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signContent);
    verify.end();
    
    const result = verify.verify(publicKey, sign, 'base64');
    console.log('验签结果:', result ? '✅通过' : '❌失败');
    
    return result;
  } catch (error: any) {
    console.error('验签异常:', error.message);
    return false;
  }
}

/**
 * 查询支付宝订单状态
 */
export async function queryAlipayOrder(outTradeNo: string): Promise<string | null> {
  const config = getAlipayKeys();
  
  if (!config.isValid) {
    console.error('配置无效，无法查询');
    return null;
  }

  const bizContent = JSON.stringify({ out_trade_no: outTradeNo });
  const params: Record<string, string> = {
    app_id: config.appId,
    method: 'alipay.trade.query',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    version: '1.0',
    biz_content: bizContent,
  };

  try {
    params.sign = generateSign(params, config.privateKey);

    const formBody = new URLSearchParams(params).toString();
    const response = await fetch(process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });

    const data = await response.json();
    console.log('查询响应:', JSON.stringify(data).substring(0, 200));

    // lib/alipay.ts 第 204 行附近
    if (data.alipay_trade_query_response?.code === '10000') {
      return data.alipay_trade_query_response.trade_status;
    } else if (data.alipay_trade_query_response?.sub_code === 'ACQ.TRADE_NOT_EXIST') {
      // 交易不存在（还没支付），正常情况，不打ERROR日志
      console.log('⏳ 等待支付中...');
      return null;
    } else {
      console.error('查询失败:', data.alipay_trade_query_response?.msg);
      return null;
    }
  } catch (error: any) {
    console.error('查询异常:', error.message);
    return null;
  }
}
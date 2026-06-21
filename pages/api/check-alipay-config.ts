// pages/api/check-alipay-config.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAlipayKeys } from '../../lib/alipay';
import fs from 'fs';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const config = getAlipayKeys();
  
  // 检查文件是否存在
  const privateKeyPath = process.env.ALIPAY_PRIVATE_KEY_PATH || '/app/alipay_private_key.pem';
  const publicKeyPath = process.env.ALIPAY_PUBLIC_KEY_PATH || '/app/alipay_public_key.pem';
  
  const fileStatus = {
    privateKey: {
      path: privateKeyPath,
      exists: false,
      size: 0,
    },
    publicKey: {
      path: publicKeyPath,
      exists: false,
      size: 0,
    },
  };

  try {
    if (fs.existsSync(privateKeyPath)) {
      fileStatus.privateKey.exists = true;
      fileStatus.privateKey.size = fs.statSync(privateKeyPath).size;
    }
  } catch (e) {}

  try {
    if (fs.existsSync(publicKeyPath)) {
      fileStatus.publicKey.exists = true;
      fileStatus.publicKey.size = fs.statSync(publicKeyPath).size;
    }
  } catch (e) {}

  res.status(200).json({
    config: {
      valid: config.isValid,
      errors: config.errors,
      appIdPrefix: config.appId ? config.appId.substring(0, 4) + '***' : '未设置',
      hasPrivateKey: !!config.privateKey,
      hasPublicKey: !!config.publicKey,
      privateKeyLength: config.privateKey?.length || 0,
      publicKeyLength: config.publicKey?.length || 0,
    },
    files: fileStatus,
    env: {
      gateway: process.env.ALIPAY_GATEWAY || '默认',
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || '未设置',
    },
  });
}
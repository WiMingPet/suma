// 腾讯云短信服务（演示模式 - 验证码显示在终端）

// 使用全局变量确保跨文件共享
declare global {
  var _codeStorage: Record<string, { code: string; expires: number }> | undefined
}

const codeStorage = global._codeStorage || {}
global._codeStorage = codeStorage

export function storeCode(phone: string, code: string): void {
  codeStorage[phone] = {
    code,
    expires: Date.now() + 5 * 60 * 1000
  }
  console.log('storeCode 已存储:', phone, code, '当前存储:', Object.keys(codeStorage))
}

export function getStoredCode(phone: string): string | null {
  const stored = codeStorage[phone]
  console.log('getStoredCode 查询:', phone, '找到:', stored)
  if (stored && stored.expires > Date.now()) {
    return stored.code
  }
  delete codeStorage[phone]
  return null
}

// 发送短信验证码（演示模式）
export async function sendSmsCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  
  console.log('========== 发送验证码 ==========')
  console.log('手机号:', phoneNumber)
  console.log('验证码:', code)
  console.log('================================')
  
  storeCode(phoneNumber, code)
  
  return { success: true, code }
}
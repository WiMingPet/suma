import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

declare global {
  var _localUsers: Record<string, any>
}

if (!global._localUsers) {
  global._localUsers = {}
}
const localUsers = global._localUsers

const MAX_FREE = 3

// 阿里云语音识别配置
const ALIYUN_ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID!
const ALIYUN_ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET!
const ALIYUN_SPEECH_APPKEY = process.env.ALIYUN_SPEECH_APPKEY!

// 生成阿里云签名
function generateSignature(secret: string, method: string, path: string, body: string, date: string): string {
  const stringToSign = `${method}\n${path}\n${date}\n${body}`
  const hmac = crypto.createHmac('sha1', secret)
  hmac.update(stringToSign)
  return hmac.digest('base64')
}

// 语音转文字
async function speechToText(audioBase64: string): Promise<string> {
  // 将 base64 转为二进制
  const audioBuffer = Buffer.from(audioBase64, 'base64')
  const date = new Date().toUTCString()
  const body = audioBuffer.toString('base64')
  const path = '/pop/api/asr/v1/recognize'
  const method = 'POST'

  const signature = generateSignature(ALIYUN_ACCESS_KEY_SECRET, method, path, body, date)

  const response = await fetch(`https://nls-meta.cn-shanghai.aliyuncs.com${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `LTAI ${ALIYUN_ACCESS_KEY_ID}:${signature}`,
      'Date': date,
      'Content-Type': 'application/octet-stream',
      'Content-Length': audioBuffer.length.toString(),
      'X-NLS-AppKey': ALIYUN_SPEECH_APPKEY,
    },
    body: audioBuffer,
  })

  const data = await response.json()

  if (data.status === 200 && data.result) {
    return data.result
  } else {
    console.error('语音识别失败:', data)
    throw new Error('语音识别失败')
  }
}

// 调用阿里云百炼生成代码
async function generateCode(prompt: string): Promise<string> {
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: `你是一个专业的前端开发专家。根据用户的需求，生成完整的 HTML/CSS/JS 代码。要求：
1. 代码必须是完整的单文件，可以直接在浏览器运行
2. 样式现代美观，响应式设计
3. 只输出代码，不要有任何解释
4. 使用中文界面`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 8192
    })
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message || 'API调用失败')
  }
  return data.choices[0].message.content
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { audioBase64, userId } = req.body

  console.log('========== generate-voice ==========')
  console.log('userId:', userId)
  console.log('音频大小:', audioBase64?.length || 0)

  if (!audioBase64) {
    return res.status(400).json({ error: '请录音' })
  }

  if (!userId) {
    return res.status(400).json({ error: '用户不存在' })
  }

  const user = localUsers[userId]
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  if (!user.is_pro && (user.daily_count || 0) >= MAX_FREE) {
    return res.status(403).json({ error: `今日免费次数已用完（上限${MAX_FREE}次），请升级Pro会员` })
  }

  let recognizedText = ''
  let generatedCode = ''
  let errorMsg = ''

  try {
    // 1. 语音转文字
    console.log('开始语音识别...')
    recognizedText = await speechToText(audioBase64)
    console.log('识别结果:', recognizedText)

    // 2. 生成代码
    console.log('开始生成代码...')
    generatedCode = await generateCode(recognizedText)
    console.log('生成成功，代码长度:', generatedCode.length)

  } catch (err: any) {
    errorMsg = err.message || '处理失败'
    console.error('错误:', err)
  }

  // 降级代码
  if (!generatedCode && errorMsg) {
    generatedCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>语音生成应用</title><style>body{font-family:sans-serif;padding:20px;background:linear-gradient(135deg,#4facfe,#00f2fe);color:#fff;min-height:100vh;}</style></head><body><div style="max-width:600px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:16px;padding:24px"><h1>🎤 语音生成应用</h1><p>识别内容: ${recognizedText || '无'}</p><p>⚠️ ${errorMsg}</p><button onclick="alert('Hello!')">点击测试</button></div></body></html>`
  }

  if (generatedCode) {
    user.daily_count = (user.daily_count || 0) + 1
  }

  return res.status(200).json({
    success: true,
    code: generatedCode,
    recognizedText,
    remaining: user.is_pro ? -1 : (MAX_FREE - (user.daily_count || 0))
  })
}
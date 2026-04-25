import type { NextApiRequest, NextApiResponse } from 'next'
import * as tencentcloud from 'tencentcloud-sdk-nodejs'
import { getUserPoints, deductPoints, incrementFreeUsed, getFreeUsed, getOrCreateUserInDB } from '../../lib/orderService'

const MAX_FREE = 3

// 腾讯云配置
const SECRET_ID = process.env.TENCENT_SMS_SECRET_ID!
const SECRET_KEY = process.env.TENCENT_SMS_SECRET_KEY!
const APP_ID = '1414007345'

// 临时开关：false = 真实API
const USE_MOCK = false

const AsrClient = tencentcloud.asr.v20190614.Client

// 语音识别
async function speechToText(audioBase64: string): Promise<string> {
  if (USE_MOCK) {
    console.log('模拟模式：返回固定文字')
    return '帮我生成一个番茄钟计时器'
  }

  const audioBuffer = Buffer.from(audioBase64, 'base64')
  const audioData = audioBuffer.toString('base64')
  
  const client = new AsrClient({
    credential: {
      secretId: SECRET_ID,
      secretKey: SECRET_KEY,
    },
    region: 'ap-shanghai',
  })

  const params = {
    EngSerViceType: '16k_zh',
    SourceType: 1,
    VoiceFormat: 'wav',
    Data: audioData,
    DataLen: audioBuffer.length,
  }

  const response = await client.SentenceRecognition(params)
  if (response.Result) {
    return response.Result
  } else {
    throw new Error('识别失败')
  }
}

// 生成代码
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
  if (data.error) throw new Error(data.error.message || '生成失败')
  return data.choices[0].message.content
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { audioBase64, userId } = req.body

  if (!audioBase64) return res.status(400).json({ error: '请录音' })
  if (!userId) return res.status(400).json({ error: '用户ID不能为空' })

  // 从数据库获取或创建用户
  const userRecord = await getOrCreateUserInDB(userId)
  const isPro = userRecord.is_pro

  // 从数据库获取已使用的免费次数
  const freeUsed = await getFreeUsed(userId)
  const remainingCount = Math.max(0, MAX_FREE - freeUsed)

  // 检查次数（免费用户）
  if (!isPro && remainingCount <= 0) {
    return res.status(403).json({ error: `免费次数已用完（共${MAX_FREE}次），请升级Pro会员或购买点币` })
  }

  // 只有 Pro 用户才检查点币余额
  if (isPro) {
    const points = await getUserPoints(userId)
    if (points <= 0) {
      return res.status(403).json({ error: '点币余额不足，请购买点币套餐' })
    }
  }

  let recognizedText = ''
  let generatedCode = ''
  let errorMsg = ''

  try {
    console.log('开始语音识别...')
    recognizedText = await speechToText(audioBase64)
    console.log('识别结果:', recognizedText)

    console.log('开始生成代码...')
    generatedCode = await generateCode(recognizedText)
    console.log('生成成功，代码长度:', generatedCode.length)
  } catch (err: any) {
    errorMsg = err.message || '处理失败'
    console.error('错误:', err)
  }

  if (!generatedCode && errorMsg) {
    generatedCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>语音生成应用</title><style>body{font-family:sans-serif;padding:20px;background:linear-gradient(135deg,#4facfe,#00f2fe);color:#fff;min-height:100vh;}</style></head><body><div style="max-width:600px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:16px;padding:24px"><h1>🎤 语音生成应用</h1><p>识别内容: ${recognizedText || '无'}</p><p>⚠️ ${errorMsg}</p><button onclick="alert('Hello!')">点击测试</button></div></body></html>`
  }

  if (generatedCode) {
    // 语音识别按时长估算点币
    let cost = 15
    if (audioBase64) {
      const audioSize = (audioBase64.length * 0.75) / 1024
      const estimatedDuration = Math.floor(audioSize / 16)
      cost = Math.max(15, Math.floor(estimatedDuration / 60) * 2)
      console.log(`音频大小: ${Math.round(audioSize)}KB，估算时长: ${estimatedDuration}秒，消耗点币: ${cost}`)
    }

    // 所有用户都扣点币
    await deductPoints(userId, cost)

    // 只有免费用户才增加免费次数
    if (!isPro) {
      await incrementFreeUsed(userId)
    }
  }

  // 获取最新的剩余次数和点币余额
  const newFreeUsed = await getFreeUsed(userId)
  const remaining = isPro ? -1 : Math.max(0, MAX_FREE - newFreeUsed)
  const finalPoints = await getUserPoints(userId)

  return res.status(200).json({
    success: true,
    code: generatedCode,
    recognizedText,
    remaining: remaining,
    points: finalPoints,
    free_used: newFreeUsed
  })
}
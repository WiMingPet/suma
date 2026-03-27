import type { NextApiRequest, NextApiResponse } from 'next'

declare global {
  var _localUsers: Record<string, any>
}

if (!global._localUsers) {
  global._localUsers = {}
}
const localUsers = global._localUsers

const MAX_FREE = 3

// 模拟语音识别（后续可接入真实API）
async function speechToText(audioBase64: string): Promise<string> {
  console.log('语音识别（模拟）...')
  // TODO: 替换为真实阿里云语音识别 API
  return '帮我生成一个国际物流运输合同模板'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { audioBase64, userId } = req.body

  console.log('========== generate-voice ==========')
  console.log('userId:', userId)

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

  // 1. 语音转文字
  let recognizedText = ''
  try {
    recognizedText = await speechToText(audioBase64)
    console.log('识别结果:', recognizedText)
  } catch (err) {
    console.error('语音识别失败:', err)
    recognizedText = '帮我生成一个应用'
  }

  // 2. 调用文字生成
  let generatedCode = ''
  let errorMsg = ''

  try {
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
            content: recognizedText
          }
        ],
        temperature: 0.7,
        max_tokens: 4096
      })
    })

    const data = await response.json()
    
    if (data.error) {
      errorMsg = data.error.message || 'API调用失败'
      console.error('API错误:', data.error)
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      generatedCode = data.choices[0].message.content
      console.log('生成成功，代码长度:', generatedCode.length)
    } else {
      errorMsg = '返回数据格式错误'
    }
  } catch (err: any) {
    errorMsg = err.message || '网络请求失败'
    console.error('请求错误:', err)
  }

  if (!generatedCode && errorMsg) {
    generatedCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>语音生成应用</title><style>body{font-family:sans-serif;padding:20px;background:linear-gradient(135deg,#4facfe,#00f2fe);color:#fff;min-height:100vh;}</style></head><body><div style="max-width:600px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:16px;padding:24px"><h1>🎤 语音生成应用</h1><p>识别内容: ${recognizedText}</p><p>⚠️ ${errorMsg}</p><button onclick="alert('Hello!')">点击测试</button></div></body></html>`
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
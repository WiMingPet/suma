import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser } from '../../lib/store'

// 免费用户每日最大次数
const MAX_FREE = 3

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt, userId } = req.body

  console.log('========== generate-text ==========')
  console.log('userId:', userId)
  console.log('prompt:', prompt)

  if (!prompt) {
    return res.status(400).json({ error: '请输入应用描述' })
  }

  if (!userId) {
    return res.status(400).json({ error: '用户ID不能为空' })
  }

  // 使用新的存储获取用户
  const user = getUser(userId)
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  // 检查次数
  if (!user.isPro && (user.dailyCount || 0) >= MAX_FREE) {
    return res.status(403).json({ error: `今日免费次数已用完（上限${MAX_FREE}次），请升级Pro会员` })
  }

  // 调用阿里云百炼 API
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
4. 使用中文界面
5. 代码必须完整，不要省略任何部分，不要截断`
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
      errorMsg = data.error.message || 'API调用失败'
      console.error('API错误:', data.error)
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      generatedCode = data.choices[0].message.content
      console.log('生成成功，代码长度:', generatedCode.length)
    } else {
      errorMsg = '返回数据格式错误'
      console.error('返回数据:', data)
    }
  } catch (err: any) {
    errorMsg = err.message || '网络请求失败'
    console.error('请求错误:', err)
  }

  // 降级代码
  if (!generatedCode && errorMsg) {
    console.log('使用降级模拟代码')
    generatedCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI生成应用</title><style>body{font-family:sans-serif;padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;min-height:100vh;}</style></head><body><div style="max-width:600px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:16px;padding:24px"><h1>${prompt.substring(0, 30)}</h1><p>⚠️ ${errorMsg}</p><p>这是降级模拟代码</p><button onclick="alert('Hello!')">点击测试</button></div></body></html>`
  }

  // 更新使用次数（仅当生成成功时）
  if (generatedCode) {
    user.dailyCount = (user.dailyCount || 0) + 1
    // 更新存储中的用户
    const { userStore } = await import('../../lib/store')
    userStore.set(userId, user)
  }

  const remaining = user.isPro ? -1 : Math.max(0, MAX_FREE - (user.dailyCount || 0))

  return res.status(200).json({
    success: true,
    code: generatedCode,
    remaining: remaining
  })
}
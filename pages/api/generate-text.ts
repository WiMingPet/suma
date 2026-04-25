import type { NextApiRequest, NextApiResponse } from 'next'
import { getOrCreateUser } from '../../lib/store'
import { getUserPoints, deductPoints, incrementFreeUsed, getFreeUsed } from '../../lib/orderService'

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

  // 使用 getOrCreateUser，自动创建用户（如果不存在）
  const user = getOrCreateUser(userId)

  // 从数据库获取已使用的免费次数
  const freeUsed = await getFreeUsed(userId)
  const remainingCount = Math.max(0, MAX_FREE - freeUsed)

  // 检查次数（免费用户）
  if (!user.isPro && remainingCount <= 0) {
    return res.status(403).json({ error: `免费次数已用完（共${MAX_FREE}次），请升级Pro会员或购买点币` })
  }

  // 获取用户点币（非Pro用户需要检查）
  let userPoints = 0
  if (!user.isPro) {
    userPoints = await getUserPoints(userId)
    if (userPoints <= 0) {
      return res.status(403).json({ error: '点币余额不足，请购买点币套餐' })
    }
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

  // 更新使用次数和扣点币（仅当生成成功时）
  if (generatedCode) {
    // 计算实际字数
    let contentLength = generatedCode.length
    const chineseChars = generatedCode.match(/[\u4e00-\u9fa5]/g) || []
    contentLength = chineseChars.length || generatedCode.length
    
    // 每100字2点币，向上取整
    const costPerHundred = 2
    const cost = Math.max(1, Math.ceil(contentLength / 100) * costPerHundred)
    
    console.log(`生成内容长度: ${contentLength}字，消耗点币: ${cost}`)

    // 非Pro用户扣点币并增加免费次数
    if (!user.isPro) {
      await deductPoints(userId, cost)
      await incrementFreeUsed(userId)
    }
  }

  // 获取最新的剩余次数和点币余额
  const newFreeUsed = await getFreeUsed(userId)
  const remaining = user.isPro ? -1 : Math.max(0, MAX_FREE - newFreeUsed)
  const finalPoints = await getUserPoints(userId)

  return res.status(200).json({
    success: true,
    code: generatedCode,
    remaining: remaining,
    points: finalPoints,
    free_used: newFreeUsed
  })
}
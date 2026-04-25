import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserPoints, deductPoints, incrementFreeUsed, getFreeUsed, getOrCreateUserInDB } from '../../lib/orderService'

const MAX_FREE = 3

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, prompt, userId } = req.body

  console.log('========== generate-image ==========')
  console.log('userId:', userId)
  console.log('补充描述:', prompt)
  console.log('图片大小:', imageBase64?.length || 0)

  if (!imageBase64) {
    return res.status(400).json({ error: '请上传图片' })
  }

  if (!userId) {
    return res.status(400).json({ error: '用户ID不能为空' })
  }

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

  // 获取用户点币（非Pro用户需要检查）
  let userPoints = 0
  if (!isPro) {
    userPoints = await getUserPoints(userId)
    if (userPoints <= 0) {
      return res.status(403).json({ error: '点币余额不足，请购买点币套餐' })
    }
  }

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
        model: 'qwen-vl-plus',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: `请仔细分析这张图片，以技术教程的风格输出详细内容。

## 输出格式要求
1. 先用一段话概括图片展示的核心内容
2. 如果涉及接线，用表格列出引脚对应关系
3. 列出清晰的操作步骤（用有序列表）
4. 补充必要的注意事项或避坑指南
5. 最后用一句总结性的话收尾

## 样式要求
- 使用现代、清爽的卡片式布局
- 代码必须完整，可直接在浏览器运行
- 标题、表格、列表要有层次感
- 整体风格简洁专业

${prompt ? `补充要求：${prompt}` : ''}

请直接输出完整的 HTML 代码，确保内容充实、排版清晰。`
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 8192
      })
    })

    const data = await response.json()
    console.log('API响应状态:', response.status)
    
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

  if (!generatedCode && errorMsg) {
    generatedCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>图片识别应用</title><style>body{font-family:sans-serif;padding:20px;background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;min-height:100vh;}</style></head><body><div style="max-width:600px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:16px;padding:24px"><h1>📸 图片识别应用</h1><p>⚠️ ${errorMsg}</p><p>${prompt ? `补充描述: ${prompt}` : ''}</p><button onclick="alert('Hello!')">点击测试</button></div></body></html>`
  }

  if (generatedCode) {
    // 图片识别按分辨率估算点币
    let cost = 30
    if (imageBase64) {
      const imageSize = (imageBase64.length * 0.75) / 1024
      cost = Math.max(30, Math.floor(imageSize / 100) * 10)
      console.log(`图片大小: ${Math.round(imageSize)}KB，消耗点币: ${cost}`)
    }

    // 非Pro用户扣点币并增加免费次数
    if (!isPro) {
      await deductPoints(userId, cost)
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
    remaining: remaining,
    points: finalPoints,
    free_used: newFreeUsed
  })
}
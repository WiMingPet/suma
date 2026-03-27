import type { NextApiRequest, NextApiResponse } from 'next'

declare global {
  var _localUsers: Record<string, any>
}

if (!global._localUsers) {
  global._localUsers = {}
}
const localUsers = global._localUsers

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
    return res.status(400).json({ error: '用户不存在' })
  }

  const user = localUsers[userId]
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  if (!user.is_pro && (user.daily_count || 0) >= MAX_FREE) {
    return res.status(403).json({ error: `今日免费次数已用完（上限${MAX_FREE}次），请升级Pro会员` })
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
    user.daily_count = (user.daily_count || 0) + 1
  }

  return res.status(200).json({
    success: true,
    code: generatedCode,
    remaining: user.is_pro ? -1 : (MAX_FREE - (user.daily_count || 0))
  })
}
import type { NextApiRequest, NextApiResponse } from 'next'
import { query } from '../../lib/db'
import { getUserPoints, deductPoints, incrementFreeUsed, getFreeUsed, getOrCreateUserInDB } from '../../lib/orderService'

const MAX_FREE = 3

// ✅ AI 标识标签
const AI_LABEL = `<!-- 🤖 AI生成标识 -->
<div style="background:#f0f7ff;padding:6px 14px;font-size:12px;color:#4a6fa5;text-align:center;border-bottom:2px solid #d0e0ff;font-family:system-ui,sans-serif;position:sticky;top:0;z-index:999;">
  🤖 本页面由 AI 生成 · 内容仅供参考
</div>`;

function addAILabel(code: string): string {
  if (code.includes('<body>')) {
    return code.replace('<body>', `<body>\n${AI_LABEL}`);
  }
  if (code.includes('<html>')) {
    return code.replace('<html>', `<html>\n${AI_LABEL}`);
  }
  return AI_LABEL + '\n' + code;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, prompt, userId, background } = req.body

  console.log('========== generate-image ==========')

  if (!imageBase64) return res.status(400).json({ error: '请上传图片' })
  if (!userId) return res.status(400).json({ error: '用户ID不能为空' })

  const userRecord = await getOrCreateUserInDB(userId)
  const isPro = userRecord.is_pro
  const freeUsed = await getFreeUsed(userId)
  const remainingCount = Math.max(0, MAX_FREE - freeUsed)

  if (!isPro && remainingCount <= 0) {
    return res.status(403).json({ error: `免费次数已用完（共${MAX_FREE}次），请升级Pro会员或购买点币` })
  }

  if (isPro) {
    const points = await getUserPoints(userId)
    if (points <= 0) {
      return res.status(403).json({ error: '点币余额不足，请购买点币套餐' })
    }
  }

  if (background) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await query(
      `INSERT INTO tasks (task_id, user_id, type, status, prompt, name) VALUES ($1, $2, $3, $4, $5, $6)`,
      [taskId, userId, 'image', 'processing', prompt || '', `图片应用-${Date.now()}`]
    );
    res.status(200).json({ success: true, taskId, message: '后台生成中，可关闭页面' });
    executeImageTask(taskId, userId, imageBase64, prompt, isPro).catch(err => {
      console.error('后台生成失败:', err);
      query('UPDATE tasks SET status = $1 WHERE task_id = $2', ['failed', taskId]);
    });
    return;
  }

  const result = await executeImageGeneration(userId, imageBase64, prompt, isPro);
  if (!result.success) return res.status(500).json({ error: '生成失败' });

  const codeWithLabel = addAILabel(result.code);
  const appId = `app_${Date.now()}`;
  await query(
    `INSERT INTO saved_apps (app_id, user_id, name, code, type) VALUES ($1, $2, $3, $4, $5)`,
    [appId, userId, `图片应用-${Date.now()}`, codeWithLabel, 'image']
  );

  const newFreeUsed = await getFreeUsed(userId);
  const finalPoints = await getUserPoints(userId);
  return res.status(200).json({ success: true, code: codeWithLabel, free_used: newFreeUsed, points: finalPoints });
}

async function executeImageTask(taskId: string, userId: string, imageBase64: string, prompt: string, isPro: boolean) {
  const result = await executeImageGeneration(userId, imageBase64, prompt, isPro);
  if (result.success) {
    const codeWithLabel = addAILabel(result.code);
    const appId = `app_${Date.now()}`;
    await query(`UPDATE tasks SET status = $1, code = $2, updated_at = NOW() WHERE task_id = $3`, ['completed', codeWithLabel, taskId]);
    await query(`INSERT INTO saved_apps (app_id, user_id, name, code, type) VALUES ($1, $2, $3, $4, $5)`, [appId, userId, `图片应用-${Date.now()}`, codeWithLabel, 'image']);
  } else {
    await query('UPDATE tasks SET status = $1 WHERE task_id = $2', ['failed', taskId]);
  }
}

async function executeImageGeneration(userId: string, imageBase64: string, prompt: string, isPro: boolean) {
  let generatedCode = '';
  let errorMsg = '';

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen3-vl-32b-thinking',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: `请仔细分析这张图片，以技术教程的风格输出详细内容。

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
          }]
        }],
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    const data = await response.json();
    if (data.error) {
      errorMsg = data.error.message || 'API调用失败';
    } else if (data.choices?.[0]?.message) {
      generatedCode = data.choices[0].message.content;
    } else {
      errorMsg = '返回数据格式错误';
    }
  } catch (err: any) {
    errorMsg = err.message || '网络请求失败';
  }

  if (!generatedCode) {
    generatedCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>图片识别应用</title><style>body{font-family:sans-serif;padding:20px;background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;min-height:100vh;}</style></head><body><div style="max-width:600px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:16px;padding:24px"><h1>📸 图片识别应用</h1><p>⚠️ ${errorMsg}</p></div></body></html>`;
  }

  if (isPro) {
    await deductPoints(userId, 30);
  } else {
    await incrementFreeUsed(userId);
  }

  return { success: true, code: generatedCode };
}
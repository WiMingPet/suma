import type { NextApiRequest, NextApiResponse } from 'next'
import { query } from '../../lib/db'
import { getUserPoints, deductPoints, incrementFreeUsed, getFreeUsed, getOrCreateUserInDB } from '../../lib/orderService'

const MAX_FREE = 3

// ✅ 新版：右上角小标签，不干扰内容
const AI_LABEL = `<!-- 🤖 AI生成标识 -->
<div style="position:fixed;top:12px;right:12px;background:rgba(102,126,234,0.9);color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:system-ui,sans-serif;">
  🤖 AI生成
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

  const { prompt, userId, background } = req.body

  console.log('========== generate-text ==========')
  console.log('userId:', userId)
  console.log('prompt:', prompt)
  console.log('background:', background)

  if (!prompt) {
    return res.status(400).json({ error: '请输入应用描述' })
  }

  if (!userId) {
    return res.status(400).json({ error: '用户ID不能为空' })
  }

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
      [taskId, userId, 'text', 'processing', prompt, prompt.slice(0, 30) + '...']
    );
    res.status(200).json({ success: true, taskId, message: '后台生成中，可关闭页面' });
    executeTextTask(taskId, userId, prompt, isPro).catch(err => {
      console.error('后台生成失败:', err);
      query('UPDATE tasks SET status = $1 WHERE task_id = $2', ['failed', taskId]);
    });
    return;
  }

  const result = await executeTextGeneration(userId, prompt, isPro);
  if (!result.success) {
    return res.status(500).json({ error: '生成失败' });
  }

  const codeWithLabel = addAILabel(result.code);
  const appId = `app_${Date.now()}`;
  await query(
    `INSERT INTO saved_apps (app_id, user_id, name, code, type) VALUES ($1, $2, $3, $4, $5)`,
    [appId, userId, prompt.slice(0, 30) + '...', codeWithLabel, 'text']
  );

  const newFreeUsed = await getFreeUsed(userId);
  const finalPoints = await getUserPoints(userId);

  return res.status(200).json({
    success: true,
    code: codeWithLabel,
    free_used: newFreeUsed,
    points: finalPoints
  });
}

async function executeTextTask(taskId: string, userId: string, prompt: string, isPro: boolean) {
  const result = await executeTextGeneration(userId, prompt, isPro);
  if (result.success) {
    const codeWithLabel = addAILabel(result.code);
    const appId = `app_${Date.now()}`;
    await query(
      `UPDATE tasks SET status = $1, code = $2, updated_at = NOW() WHERE task_id = $3`,
      ['completed', codeWithLabel, taskId]
    );
    await query(
      `INSERT INTO saved_apps (app_id, user_id, name, code, type) VALUES ($1, $2, $3, $4, $5)`,
      [appId, userId, prompt.slice(0, 30) + '...', codeWithLabel, 'text']
    );
  } else {
    await query('UPDATE tasks SET status = $1 WHERE task_id = $2', ['failed', taskId]);
  }
}

async function executeTextGeneration(userId: string, prompt: string, isPro: boolean) {
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
        model: 'qwen3.7-plus',
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
          { role: 'user', content: prompt }
        ],
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
    generatedCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI生成应用</title><style>body{font-family:sans-serif;padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;min-height:100vh;}</style></head><body><div style="max-width:600px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:16px;padding:24px"><h1>${prompt.substring(0, 30)}</h1><p>⚠️ ${errorMsg}</p></div></body></html>`;
  }

  if (isPro) {
    const cost = 10;
    console.log(`💰 扣除点币: ${cost}`);
    await deductPoints(userId, cost);
  } else {
    await incrementFreeUsed(userId);
    console.log('🆓 扣除免费次数');
  }

  return { success: true, code: generatedCode };
}
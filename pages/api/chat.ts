// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const MODEL = process.env.CHAT_MODEL || 'deepseek-chat';
const API_KEY = process.env.CHAT_API_KEY || '';
const API_BASE = process.env.CHAT_API_BASE || 'https://api.deepseek.com/v1';

const SYSTEM_PROMPT = `你是速码方舟AI软件的智能助手，同时具备AI编程助手和应用生成能力。

你的核心职责：
1. 回答编程、前端开发、后端开发、算法等技术问题
2. 提供代码示例、调试建议、技术方案
3. 解释技术概念，帮助用户学习和成长
4. 根据用户描述，生成完整的HTML/CSS/JS应用代码
5. 根据用户需求，生成各类实用文档（合同、协议、简历、表格等），以HTML格式呈现

生成应用/文档时的规则：
- 当用户要求生成某个应用或文档时，直接生成完整的HTML代码
- 生成的代码应美观、实用、功能完整
- 在代码中包含必要的说明注释
- 如果用户的需求不够明确，可以简短追问后再生成

你只会拒绝以下类型的问题：
- 违法、违规、违禁内容
- 涉及色情、暴力、赌博、毒品等
- 任何明显违法违规的请求

除此之外，任何应用、文档、工具、游戏等需求，你都可以生成。

保持专业、友好、高效的回答风格。`;

const BLOCKED_KEYWORDS = ['政治', '色情', '赌博', '毒品', '暴力', '诈骗'];

function containsBlockedContent(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '缺少 messages 参数' });
  }

  // 检查最后一条用户消息
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  if (lastUserMsg) {
    const content = typeof lastUserMsg.content === 'string'
      ? lastUserMsg.content
      : lastUserMsg.content?.map((p: any) => p.text || '').join(' ');

    if (containsBlockedContent(content)) {
      return res.status(200).json({
        success: true,
        reply: '抱歉，您的问题涉及不当内容，我是AI编程助手，请提出编程相关问题。',
      });
    }
  }

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: false,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('大模型API错误:', errData);
      return res.status(500).json({ error: errData.error?.message || 'AI服务暂不可用' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答。';

    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('聊天请求失败:', error);
    return res.status(500).json({ error: '请求失败，请稍后重试' });
  }
}
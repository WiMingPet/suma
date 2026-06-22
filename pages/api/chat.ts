// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const MODEL = process.env.CHAT_MODEL || 'deepseek-v4-flash';
const API_KEY = process.env.CHAT_API_KEY || '';
const API_BASE = process.env.CHAT_API_BASE || 'https://api.deepseek.com';

const SYSTEM_PROMPT = `你是速码方舟AI软件的智能助手，同时具备AI编程助手和应用生成能力。

你的核心职责：
1. 回答编程、前端开发、后端开发、算法等技术问题
2. 提供代码示例、调试建议、技术方案
3. 解释技术概念，帮助用户学习和成长
4. 根据用户描述，生成完整的HTML/CSS/JS应用代码
5. 根据用户需求，生成各类实用文档（合同、协议、简历、试卷、表格等），以HTML格式呈现

⚠️ 重要交互规则：

【规则1：需求不明确时先追问】
当用户的需求不够具体时，必须先简短追问确认，而不是直接生成。
例如：
- 用户说"生成一个试卷" → 追问："请问是什么科目？几年级？需要多少道题？"
- 用户说"做一个游戏" → 追问："什么类型的游戏？有没有偏好的风格？"
- 用户说"生成一份合同" → 追问："什么类型的合同？需要哪些条款？"
追问不超过2个问题，用户补充后立即生成。

【规则2：需求明确时直接生成并引导操作】
当用户需求足够明确时，直接生成完整代码，并在代码后面附带引导语：
- "✅ 应用已生成！您可以使用下方的【预览】按钮查看效果，或点击【下载】保存到本地，也可以【保存到我的应用】方便以后查看。"
- 如果适合进一步优化，可加上："如需调整样式或功能，请告诉我具体需求。"

【规则3：生成代码的格式】
- 使用 \`\`\`html ... \`\`\` 包裹完整代码
- 代码必须是完整的、可直接运行的HTML文件
- 包含必要的CSS样式，让应用美观大方
- 包含说明注释

你只会拒绝以下类型的问题：
- 违法、违规、违禁内容
- 涉及色情、暴力、赌博、毒品等
- 任何明显违法违规的请求

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

  const { messages, stream: useStream } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '缺少 messages 参数' });
  }

  // 内容过滤
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  if (lastUserMsg) {
    const content = typeof lastUserMsg.content === 'string'
      ? lastUserMsg.content
      : lastUserMsg.content?.map((p: any) => p.text || '').join(' ');

    if (containsBlockedContent(content)) {
      // 流式也返回拒绝内容
      if (useStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.write(`data: ${JSON.stringify({ content: '抱歉，您的问题涉及不当内容，我是AI编程助手，请提出编程相关问题。' })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return res.status(200).json({
        success: true,
        reply: '抱歉，您的问题涉及不当内容，我是AI编程助手，请提出编程相关问题。',
      });
    }
  }

  const apiMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        stream: useStream ?? false,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('大模型API错误:', errData);
      return res.status(500).json({ error: errData.error?.message || 'AI服务暂不可用' });
    }

    // 流式输出
    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const reader = response.body?.getReader();
      if (!reader) {
        return res.status(500).json({ error: '无法获取响应流' });
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // ✅ 确保发送结束标志
            res.write('data: [DONE]\n\n');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {
              // 忽略
            }
          }
        }
      } catch (err) {
        console.error('流式读取错误:', err);
        // ✅ 错误时也发送结束标志
        res.write('data: [DONE]\n\n');
      } finally {
        reader.releaseLock();
        res.end();
      }
      return;
    }

    // 非流式输出（兼容）
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答。';
    return res.status(200).json({ success: true, reply });

  } catch (error) {
    console.error('聊天请求失败:', error);
    return res.status(500).json({ error: '请求失败，请稍后重试' });
  }
}
'use client'

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatAssistant({ isOpen, onClose }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 提取HTML代码
  const extractHtmlCode = (text: string): string | null => {
    // 匹配 ```html ... ``` 代码块
    const htmlMatch = text.match(/```html\n?([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1];
    
    // 匹配 <!DOCTYPE html> 开头的完整HTML
    const docMatch = text.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
    if (docMatch) return docMatch[0];

    // 匹配 <html> 开头的完整HTML
    const htmlTagMatch = text.match(/<html>[\s\S]*?<\/html>/i);
    if (htmlTagMatch) return htmlTagMatch[0];
    
    return null;
  };

  // 下载代码
  const handleDownloadCode = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 保存到我的应用
  const saveToMyApps = (code: string, name: string) => {
    const newApp = {
      id: Date.now().toString(),
      name: name,
      code: code,
      type: 'text',
      created_at: new Date().toISOString()
    };

    // 保存到本地
    const storedUser = localStorage.getItem('suma_user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    const userId = user?.id || 'anonymous';
    
    const apps = JSON.parse(localStorage.getItem(`suma_apps_${userId}`) || '[]');
    apps.unshift(newApp);
    localStorage.setItem(`suma_apps_${userId}`, JSON.stringify(apps));

    // 同步到服务器
    if (user?.id) {
      fetch('https://sumaai.cn/api/saved-apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify(newApp)
      }).catch(err => console.warn('同步失败', err));
    }

    alert('✅ 已保存到"我的应用"，可在侧边菜单查看');
  };

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);

    const newMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');

    const aiMsgIndex = updatedMessages.length;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('https://sumaai.cn/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, stream: true }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.content) {
                fullContent += json.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[aiMsgIndex] = { role: 'assistant', content: fullContent };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[aiMsgIndex] = { role: 'assistant', content: '网络错误，请重试' };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  // 举报功能
  const handleReport = (msg: Message) => {
    const reportContent = `举报内容：\n角色：${msg.role}\n内容：${msg.content}`;
    alert('感谢举报，我们会尽快处理。\n\n' + reportContent);
    // TODO: 发送到后端或邮箱
  };

  if (!isOpen) return null;

  // 首次使用授权弹窗
  if (!agreed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-center">
          <h3 className="text-xl font-bold mb-4">🤖 AI编程助手</h3>
          <p className="text-gray-600 mb-4 text-left">
            使用AI编程助手前，请知悉：
          </p>
          <ul className="text-gray-500 text-sm text-left space-y-2 mb-6">
            <li>• 您的对话内容将发送给第三方AI服务商处理</li>
            <li>• AI生成的回复可能不总是准确，请自行验证</li>
            <li>• 请勿输入个人隐私或敏感信息</li>
            <li>• 详见<strong>隐私政策</strong></li>
          </ul>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              拒绝
            </button>
            <button
              onClick={() => setAgreed(true)}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              同意并继续
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-y-auto">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">🤖 AI编程助手</h3>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
              aria-label="关闭"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-20">
                <p className="text-4xl mb-2">💬</p>
                <p className="font-medium text-gray-500">AI编程助手</p>
                <p className="text-sm">我可以帮你解答编程问题、生成代码</p>
              </div>
            )}
            {messages.map((msg, idx) => {
              const htmlCode = msg.role === 'assistant' ? extractHtmlCode(msg.content) : null;
              return (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-xl relative group ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    
                    {/* 代码操作按钮（仅AI回复中包含HTML代码时显示） */}
                    {htmlCode && (
                      <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 flex flex-wrap gap-2">
                        <button
                          onClick={() => setPreviewCode(htmlCode)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition flex items-center gap-1"
                        >
                          👁️ 预览
                        </button>
                        <button
                          onClick={() => handleDownloadCode(htmlCode, `AI生成应用-${Date.now()}`)}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition flex items-center gap-1"
                        >
                          📥 下载
                        </button>
                        <button
                          onClick={() => saveToMyApps(htmlCode, `AI生成应用-${Date.now()}`)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition flex items-center gap-1"
                        >
                          💾 保存
                        </button>
                      </div>
                    )}

                    {/* 举报按钮（仅AI回复显示） */}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleReport(msg)}
                        className="absolute -bottom-6 right-0 text-xs text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        🚩 举报
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl rounded-bl-none">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 底部输入区 */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="请输入问题或描述想要的应用..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="p-2 bg-blue-600 text-white rounded-full disabled:opacity-50 hover:bg-blue-700 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              内容由AI生成，仅供参考
            </p>
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      {previewCode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPreviewCode(null)} />
          <div className="relative bg-white w-full max-w-4xl h-[85vh] rounded-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
              <span className="text-sm text-gray-600">应用预览</span>
              <button
                onClick={() => setPreviewCode(null)}
                className="p-1 hover:bg-gray-200 rounded-full transition"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <iframe srcDoc={previewCode} className="w-full h-[calc(100%-40px)]" title="预览" />
          </div>
        </div>
      )}
    </>
  );
}
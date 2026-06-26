'use client'

import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'

// 动态导入 Three.js 背景组件（避免 SSR 问题）
const ThreeBackground = dynamic(() => import('../components/ThreeBackground'), {
  ssr: false
})

// 组件导入
import LoginModal from '../components/LoginModal'
import SideMenu from '../components/SideMenu'
import PaymentModal from '../components/PaymentModal'
import ChatAssistant from '../components/ChatAssistant'
import GameSnake from '../components/GameSnake'
import GameTetris from '../components/GameTetris'
import GameBubble from '../components/GameBubble'
import { useUser } from '../contexts/UserContext'


export default function Home() {
  // 状态管理
  const { user, setUser, refreshUser, logout } = useUser()
  const [showLogin, setShowLogin] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showGames, setShowGames] = useState(false)
  const [currentGame, setCurrentGame] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const router = useRouter();

  const goToMemberCenter = () => {
    router.push('/member-center');
  };
  
  // 生成功能状态
  const [generatedCode, setGeneratedCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasConsentedToAI, setHasConsentedToAI] = useState(false);

  // 各个Tab独立的输入状态
  const [textPrompt, setTextPrompt] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')

  // 图片上传状态
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  
  // 预览弹窗
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  
  // 当前激活的功能标签
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text')

  useEffect(() => {
    setGeneratedCode('');
    setPreviewCode(null);
  }, [activeTab]);

  const getRemaining = () => {
    if (!user) return 0
    if (user.is_pro) return user.points || 0
    return Math.max(0, 3 - (user.free_used || 0))
  }


  const handleLoginSuccess = (userData: any) => {
    console.log('登录成功:', userData)
    setUser(userData)
    localStorage.setItem('suma_user', JSON.stringify(userData))
  }
  
  const handleLogout = () => {
    logout()
    setShowMenu(false)
  }


  const checkAIConsent = async () => {
    if (hasConsentedToAI) return true;
    return new Promise((resolve) => {
      const confirmed = window.confirm(
        '速码方舟AI软件将把您的输入内容发送给第三方AI服务商（阿里云）以生成代码。\n\n' +
        '服务商不会使用您的数据训练其模型。\n\n' +
        '是否继续？'
      );
      if (confirmed) {
        setHasConsentedToAI(true);
        resolve(true);
      } else {
        resolve(false);
      }
    });
  };

  // 文字生成应用
  const handleGenerateText = async () => {
    if (!user) {
      setShowLogin(true)
      return
    }

    if (!user.is_pro && getRemaining() <= 0) {
      alert('免费次数已用完（共3次），请升级Pro会员或购买点币套餐')
      return
    }
    
    if (!(await checkAIConsent())) {
      alert('您需要同意AI服务协议才能使用此功能');
      return;
    }
    
    if (!textPrompt.trim()) {
      alert('请输入应用描述')
      return
    }

    setIsGenerating(true)

    try {
      const res = await fetch('https://sumaai.cn/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, prompt: textPrompt })
      })

      const data = await res.json()

      if (data.success) {
        setGeneratedCode(data.code)
        const updatedUser = {
          ...user,
          daily_count: (user.daily_count || 0) + 1,
          points: data.points ?? user.points,
          free_used: data.free_used ?? user.free_used
        }
        setUser(updatedUser)

        const newApp = {
          id: Date.now().toString(),
          name: textPrompt.slice(0, 30) + '...',
          code: data.code,
          type: 'text' as const,
          created_at: new Date().toISOString()
        }

        const apps = JSON.parse(localStorage.getItem(`suma_apps_${user.id}`) || '[]')
        apps.unshift(newApp)
        localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(apps))

        fetch('https://sumaai.cn/api/saved-apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
          body: JSON.stringify(newApp)
        }).catch(err => console.warn('服务器同步失败', err))
      } else {
        alert(data.error || '生成失败')
      }
    } catch (err) {
      alert('生成失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 图片上传处理
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // ✅ 用户取消选择，不报错
      return;
    }

    // ✅ 检查文件大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过10MB，请压缩后重试');
      // 重置input，允许重新选择
      e.target.value = '';
      return;
    }

    // ✅ 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      e.target.value = '';
      return;
    }

    try {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } catch (error) {
      console.error('图片加载失败:', error);
      alert('图片加载失败，请重试');
      e.target.value = '';
    }
  };

  // 图片生成应用
  const handleGenerateImage = async () => {
    if (!user) {
      setShowLogin(true)
      return
    }

    if (!user.is_pro && getRemaining() <= 0) {
      alert('免费次数已用完（共3次），请升级Pro会员或购买点币套餐')
      return
    }
    if (!(await checkAIConsent())) {
      alert('您需要同意AI服务协议才能使用此功能');
      return;
    }
    
    if (!imageFile) {
      alert('请上传图片')
      return
    }

    setIsGeneratingImage(true)

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]
        const res = await fetch('https://sumaai.cn/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, imageBase64: base64, prompt: imagePrompt })
        })

        const data = await res.json()

        if (data.success) {
          setGeneratedCode(data.code)
          const updatedUser = {
            ...user,
            daily_count: (user.daily_count || 0) + 1,
            points: data.points ?? user.points,
            free_used: data.free_used ?? user.free_used
          }
          setUser(updatedUser)
          
          const newApp = {
            id: Date.now().toString(),
            name: `图片应用-${Date.now()}`,
            code: data.code,
            type: 'image' as const,
            created_at: new Date().toISOString()
          }

          const apps = JSON.parse(localStorage.getItem(`suma_apps_${user.id}`) || '[]')
          apps.unshift(newApp)
          localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(apps))

          fetch('https://sumaai.cn/api/saved-apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
            body: JSON.stringify(newApp)
          }).catch(err => console.warn('服务器同步失败', err))
        } else {
          alert(data.error || '生成失败')
        }
        setIsGeneratingImage(false)
      }
      reader.readAsDataURL(imageFile)
    } catch (err) {
      alert('生成失败，请稍后重试')
      setIsGeneratingImage(false)
    }
  }

  // 后台生成 - 文字
  const handleBackgroundText = async () => {
    if (!(await checkAIConsent())) {
      alert('您需要同意AI服务协议才能使用此功能');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('https://sumaai.cn/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user!.id, prompt: textPrompt, background: true })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ 后台生成中！完成后自动保存到"我的应用"，可关闭页面');
        setTextPrompt('');
      } else {
        alert(data.error || '创建失败');
      }
    } catch (err) {
      alert('创建失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 后台生成 - 图片
  const handleBackgroundImage = async () => {
    if (!(await checkAIConsent())) {
      alert('您需要同意AI服务协议才能使用此功能');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const res = await fetch('https://sumaai.cn/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user!.id, imageBase64: base64, prompt: imagePrompt, background: true })
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ 后台生成中！完成后自动保存到"我的应用"，可关闭页面');
          setImagePreview(null);
          setImageFile(null);
          setImagePrompt('');
        } else {
          alert(data.error || '创建失败');
        }
        setIsGeneratingImage(false);
      };
      reader.readAsDataURL(imageFile!);
    } catch (err) {
      alert('创建失败，请稍后重试');
      setIsGeneratingImage(false);
    }
  };

  // 下载代码
  const handleDownload = () => {
    if (!generatedCode) return;
    const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(generatedCode);
    window.open(dataUri, '_blank');
  }

  return (
    <>
      <Head>
        <title>速码方舟AI软件 - AI 应用生成器</title>
        <meta name="description" content="使用 AI 生成 Web 应用" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </Head>

      <ThreeBackground />

      <div className="min-h-screen relative z-10">
        {/* 顶部导航 */}
        <header className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-md border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => setShowMenu(true)} className="p-2 hover:bg-white/10 rounded-lg transition">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-lg font-bold text-white leading-tight text-center">
              <span className="text-blue-400">速码</span>方舟<br/>
              AI软件
            </h1>

            <div className="flex items-center gap-2">
              {/* ✅ 未登录也能看到购买按钮 */}
              <button onClick={() => setShowPayment(true)} className="px-1.5 py-0.5 bg-yellow-500 text-black rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0">
                购买
              </button>

              {user ? (
                <div className="flex items-center gap-3">
                  <div onClick={goToMemberCenter} className="text-right cursor-pointer hover:opacity-80 transition">
                    <p className="text-sm text-white">{user.phone.slice(0, 3)}****{user.phone.slice(-4)}</p>
                    <p className="text-xs text-gray-400">
                      {user.is_pro ? `点币余额: ${user.points || 0}` : `剩余免费次数: ${Math.max(0, 3 - (user.free_used || 0))}`}
                    </p>
                  </div>
                  <button onClick={goToMemberCenter} className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-white font-bold">
                    {user.phone.slice(-2)}
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowLogin(true)} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium">
                  登录
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 主要内容区 */}
        <main className="pt-24 pb-20 px-4 max-w-6xl mx-auto">
          {/* 功能卡片 */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div 
              onClick={() => setActiveTab('text')}
              className={`p-6 rounded-2xl border transition cursor-pointer ${
                activeTab === 'text' 
                  ? 'bg-blue-600/20 border-blue-500' 
                  : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">文字生成</h3>
              <p className="text-sm text-gray-400">用文字描述你想要的应用，AI 自动生成完整代码</p>
            </div>

            <div 
              onClick={() => setActiveTab('image')}
              className={`p-6 rounded-2xl border transition cursor-pointer ${
                activeTab === 'image' 
                  ? 'bg-purple-600/20 border-purple-500' 
                  : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">图片识别</h3>
              <p className="text-sm text-gray-400">上传图片，AI 识别内容并生成对应应用</p>
            </div>

            {/* 替换为 AI 助手 */}
            <div 
              onClick={() => setShowChat(true)}
              className="p-6 rounded-2xl border transition cursor-pointer bg-gray-900/50 border-gray-700 hover:border-gray-600"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">AI助手</h3>
              <p className="text-sm text-gray-400">AI编程助手，深度对话，技术问答</p>
            </div>
          </div>

          {/* 输入区域 */}
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            {activeTab === 'text' && (
              <div>
                <textarea
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="描述你想要的应用，例如：帮我做一个计算器..."
                  className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-400">
                    {user ? (user.is_pro ? `点币余额: ${user.points || 0}` : `剩余免费次数: ${getRemaining()}`) : '登录后可使用'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!user.is_pro && getRemaining() <= 0) {
                          alert('免费次数已用完（共3次），请升级Pro会员或购买点币套餐')
                          return
                        }
                        handleGenerateText()
                      }}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {isGenerating ? '生成中...' : '等待生成'}
                    </button>
                    <button
                      onClick={() => {
                        if (!user) { setShowLogin(true); return }
                        if (!user.is_pro && getRemaining() <= 0) {
                          alert('免费次数已用完（共3次），请升级Pro会员或购买点币套餐')
                          return
                        }
                        if (!textPrompt.trim()) { alert('请输入应用描述'); return }
                        handleBackgroundText()
                      }}
                      disabled={isGenerating}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      后台生成
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'image' && (
              <div>
                <div className="flex flex-col items-center gap-4">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-gray-400">点击上传图片或拖拽</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                  
                  {imagePreview && (
                    <div className="relative">
                      <img src={imagePreview} alt="预览" className="max-h-40 max-w-full rounded-lg object-contain" />
                      <button onClick={() => { setImagePreview(null); setImageFile(null) }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="补充描述（可选）"
                    className="w-full h-20 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!user.is_pro && getRemaining() <= 0) {
                          alert('免费次数已用完（共3次），请升级Pro会员或购买点币套餐')
                          return
                        }
                        handleGenerateImage()
                      }}
                      disabled={isGeneratingImage}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {isGeneratingImage ? '生成中...' : '等待生成'}
                    </button>
                    <button
                      onClick={() => {
                        if (!user) { setShowLogin(true); return }
                        if (!user.is_pro && getRemaining() <= 0) {
                          alert('免费次数已用完（共3次），请升级Pro会员或购买点币套餐')
                          return
                        }
                        if (!imageFile) { alert('请上传图片'); return }
                        handleBackgroundImage()
                      }}
                      disabled={isGeneratingImage}
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      后台生成
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 生成结果预览 */}
          {generatedCode && (
            <div className="mt-8 bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">生成结果</h3>
                  <span className="px-2 py-0.5 text-xs bg-purple-600/30 text-purple-300 rounded-full border border-purple-500/50">🤖 AI生成</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPreviewCode(generatedCode)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">预览</button>
                  <button onClick={handleDownload} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm">下载 HTML</button>
                  <button
                    onClick={async () => {
                      const reason = prompt('请描述举报原因（选填）：');
                      try {
                        await fetch('https://sumaai.cn/api/report', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ content: generatedCode, reason: reason || '用户举报', userId: user?.id, timestamp: new Date().toISOString() })
                        });
                        alert('举报已提交，我们会尽快处理。感谢反馈！');
                      } catch (error) {
                        alert('举报提交失败，请稍后重试');
                      }
                    }}
                    className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition"
                  >
                    🚨 举报
                  </button>
                </div>
              </div>
              <div className="h-64 bg-gray-800 rounded-lg overflow-hidden">
                <iframe srcDoc={generatedCode} className="w-full h-full" title="预览" />
              </div>
            </div>
          )}
        </main>

        {/* 底部 */}
        <footer className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-md border-t border-white/10 py-3">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-4">
            <button onClick={() => setShowGames(true)} className="text-sm text-gray-400 hover:text-white transition">轻松时刻 ☕</button>
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white transition">粤ICP备2026044431号</a>
            <button onClick={() => router.push('/privacy')} className="text-sm text-gray-400 hover:text-white transition cursor-pointer">隐私政策</button>
          </div>
        </footer>
      </div>

      {/* 登录弹窗 */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} onLoginSuccess={handleLoginSuccess} />

      {/* 支付弹窗 */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        userId={user?.id || user?.phone || ''}
        onSuccess={() => {
          setShowPayment(false)
          refreshUser()
          alert('支付成功！')
        }}
      />

      {/* 侧滑菜单 */}
      <SideMenu isOpen={showMenu} onClose={() => setShowMenu(false)} />

      {/* AI 助手聊天窗口 */}
      {showChat && (
        <ChatAssistant isOpen={showChat} onClose={() => setShowChat(false)} />
      )}

      {/* 游戏选择弹窗 */}
      {showGames && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowGames(false)} />
          <div className="relative bg-gray-900 p-8 rounded-2xl border border-gray-700 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">轻松时刻</h2>
              <button onClick={() => setShowGames(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <button onClick={() => { setShowGames(false); setCurrentGame('snake') }} className="p-4 bg-green-600/20 border border-green-500/30 rounded-xl hover:bg-green-600/30 transition">
                <div className="text-3xl mb-2">🐍</div>
                <p className="text-white font-medium">贪吃蛇</p>
              </button>
              <button onClick={() => { setShowGames(false); setCurrentGame('tetris') }} className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-xl hover:bg-blue-600/30 transition">
                <div className="text-3xl mb-2">🧱</div>
                <p className="text-white font-medium">俄罗斯方块</p>
              </button>
              <button onClick={() => { setShowGames(false); setCurrentGame('bubble') }} className="p-4 bg-purple-600/20 border border-purple-500/30 rounded-xl hover:bg-purple-600/30 transition">
                <div className="text-3xl mb-2">🫧</div>
                <p className="text-white font-medium">泡泡消消乐</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 游戏组件 */}
      {currentGame === 'snake' && <GameSnake onClose={() => setCurrentGame(null)} />}
      {currentGame === 'tetris' && <GameTetris onClose={() => setCurrentGame(null)} />}
      {currentGame === 'bubble' && <GameBubble onClose={() => setCurrentGame(null)} />}

      {/* 预览弹窗 */}
      {previewCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPreviewCode(null)} />
          <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-lg overflow-hidden">
            <button onClick={() => setPreviewCode(null)} className="absolute top-4 right-4 z-10 bg-gray-900 text-white p-2 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <iframe srcDoc={previewCode} className="w-full h-full" title="预览" />
          </div>
        </div>
      )}
    </>
  )
}
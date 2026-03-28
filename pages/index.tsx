'use client'

import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'

// 动态导入 Three.js 背景组件（避免 SSR 问题）
const ThreeBackground = dynamic(() => import('../components/ThreeBackground'), {
  ssr: false
})

// 组件导入
import LoginModal from '../components/LoginModal'
import SideMenu from '../components/SideMenu'
import Game3DSpace from '../components/Game3DSpace'
import audioBufferToWav from 'audiobuffer-to-wav'
import GameSnakePro from '../components/GameSnakePro'
import GameHappyEliminate from '../components/GameHappyEliminate'
import GameEggParty from '../components/GameEggParty'

interface User {
  id: string
  phone: string
  is_pro: boolean
  daily_count: number
}

export default function Home() {
  // 状态管理
  const [user, setUser] = useState<User | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showGames, setShowGames] = useState(false)
  const [currentGame, setCurrentGame] = useState<string | null>(null)
  
  // 生成功能状态
  const [prompt, setPrompt] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [remaining, setRemaining] = useState(3)
  
  // 图片上传状态
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  
  // 语音录制状态
  const [isRecording, setIsRecording] = useState(false)
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  // 预览弹窗
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  
  // 当前激活的功能标签
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'voice'>('text')
  
  // 生成格式（HTML 或 PDF）
  const [outputFormat, setOutputFormat] = useState<'html' | 'pdf'>('html')

  // 初始化用户状态
  useEffect(() => {
    const savedUser = localStorage.getItem('suma_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error('解析用户失败', e)
        localStorage.removeItem('suma_user')
      }
    }
  }, [])

  // 检查剩余次数
  useEffect(() => {
    if (user) {
      checkLimit()
    }
  }, [user])

  const checkLimit = async () => {
    if (!user) return
    try {
      const res = await fetch('/api/check-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      const data = await res.json()
      setRemaining(data.remaining)
    } catch (err) {
      const localCount = localStorage.getItem(`suma_daily_count_${user.id}`)
      if (localCount) {
        setRemaining(Math.max(0, 3 - parseInt(localCount)))
      }
    }
  }

  const handleLoginSuccess = (userData: User) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('suma_user')
    setUser(null)
    setShowMenu(false)
  }

  // 文字生成应用
  const handleGenerateText = async () => {
    if (!user) {
      setShowLogin(true)
      return
    }
    if (!prompt.trim()) {
      alert('请输入应用描述')
      return
    }
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, prompt })
      })
      const data = await res.json()
      if (data.success) {
        setGeneratedCode(data.code)
        // 保存到本地存储
        const apps = JSON.parse(localStorage.getItem(`suma_apps_${user.id}`) || '[]')
        apps.unshift({
          id: Date.now().toString(),
          name: prompt.slice(0, 30) + '...',
          code: data.code,
          type: 'text',
          created_at: new Date().toISOString()
        })
        localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(apps))
        if (outputFormat === 'pdf') {
          setTimeout(() => {
            const printWindow = window.open('', '_blank')
            if (printWindow) {
              printWindow.document.write(data.code)
              printWindow.document.close()
              printWindow.print()
            } else {
              alert('请允许弹出窗口，以便打印PDF')
            }
          }, 100)
        }
        if (data.remaining !== undefined) setRemaining(data.remaining)
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
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  // 图片生成应用
  const handleGenerateImage = async () => {
    if (!user) { setShowLogin(true); return }
    if (!imageFile) { alert('请上传图片'); return }
    setIsGeneratingImage(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, imageBase64: base64, prompt })
        })
        const data = await res.json()
        if (data.success) {
          setGeneratedCode(data.code)
          const apps = JSON.parse(localStorage.getItem(`suma_apps_${user.id}`) || '[]')
          apps.unshift({
            id: Date.now().toString(),
            name: `图片应用-${Date.now()}`,
            code: data.code,
            type: 'image',
            created_at: new Date().toISOString()
          })
          localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(apps))
          if (outputFormat === 'pdf') {
            setTimeout(() => {
              const printWindow = window.open('', '_blank')
              if (printWindow) {
                printWindow.document.write(data.code)
                printWindow.document.close()
                printWindow.print()
              } else {
                alert('请允许弹出窗口，以便打印PDF')
              }
            }, 100)
          }
          if (data.remaining !== undefined) setRemaining(data.remaining)
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

  // 开始录音
const startRecording = async () => {
  if (!user) {
    setShowLogin(true)
    return
  }
  if (!user.is_pro && (user.daily_count || 0) >= 6) {
    alert('今日免费次数已用完')
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    audioChunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      
      // 将 webm 转为 wav
      try {
        const arrayBuffer = await webmBlob.arrayBuffer()
        const audioContext = new AudioContext()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        // 转换为 wav 格式
        const wavBuffer = audioBufferToWav(audioBuffer)
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' })
        
        const reader = new FileReader()
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1]
          await handleVoiceUpload(base64)
        }
        reader.readAsDataURL(wavBlob)
        
        await audioContext.close()
      } catch (err) {
        console.error('音频转换失败:', err)
        alert('音频处理失败，请重试')
      }
      
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.start()
    setIsRecording(true)
  } catch (err) {
    alert('无法获取麦克风权限')
  }
}

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // 上传音频到后端识别
  const handleVoiceUpload = async (audioBase64: string) => {
    if (!user) return
    setIsGeneratingVoice(true)
    try {
      const res = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, audioBase64 })
      })
      const data = await res.json()
      if (data.success) {
        setGeneratedCode(data.code)
        setPrompt(data.recognizedText)
        // 保存到本地存储
        const apps = JSON.parse(localStorage.getItem(`suma_apps_${user.id}`) || '[]')
        apps.unshift({
          id: Date.now().toString(),
          name: data.recognizedText.slice(0, 30) + '...',
          code: data.code,
          type: 'voice',
          created_at: new Date().toISOString()
        })
        localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(apps))
        if (outputFormat === 'pdf') {
          setTimeout(() => {
            const printWindow = window.open('', '_blank')
            if (printWindow) {
              printWindow.document.write(data.code)
              printWindow.document.close()
              printWindow.print()
            } else {
              alert('请允许弹出窗口，以便打印PDF')
            }
          }, 100)
        }
        if (data.remaining !== undefined) setRemaining(data.remaining)
      } else {
        alert(data.error || '识别失败')
      }
    } catch (err) {
      alert('语音处理失败')
    } finally {
      setIsGeneratingVoice(false)
    }
  }

  // 下载代码
  const handleDownload = () => {
    if (!generatedCode) return
    const blob = new Blob([generatedCode], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'generated-app.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Head>
        <title>速码 - AI 应用生成器</title>
        <meta name="description" content="使用 AI 生成 Web 应用" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Three.js 背景 */}
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
            <h1 className="text-xl font-bold text-white"><span className="text-blue-400">速</span>码</h1>
            <div>
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-white">{user.phone.slice(0,3)}****{user.phone.slice(-4)}</p>
                    <p className="text-xs text-gray-400">{user.is_pro ? 'Pro会员·无限次' : `今日剩余 ${3 - (user.daily_count || 0)} 次`}</p>
                  </div>
                  {!user.is_pro && (
                    <button onClick={() => alert('Pro会员升级功能开发中，请支付19元/月')} className="px-3 py-1 bg-yellow-500 text-black rounded-lg text-sm font-medium hover:bg-yellow-400 transition">升级Pro</button>
                  )}
                  <button onClick={() => setShowLogin(true)} className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-white font-bold">{user.phone.slice(-2)}</button>
                </div>
              ) : (
                <button onClick={() => setShowLogin(true)} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium">登录</button>
              )}
            </div>
          </div>
        </header>

        <main className="pt-24 pb-40 px-4 max-w-6xl mx-auto">
          {/* 功能卡片 */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div onClick={() => setActiveTab('text')} className={`group relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 ${activeTab === 'text' ? 'bg-gradient-to-br from-blue-600 to-cyan-600 ring-2 ring-blue-400' : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 ${activeTab === 'text' ? 'bg-white/20' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">文字生成</h3>
              <p className="text-sm text-gray-400">用文字描述你想要的应用，AI 自动生成完整代码</p>
            </div>
            <div onClick={() => setActiveTab('image')} className={`group relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 ${activeTab === 'image' ? 'bg-gradient-to-br from-purple-600 to-pink-600 ring-2 ring-purple-400' : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 ${activeTab === 'image' ? 'bg-white/20' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">图片识别</h3>
              <p className="text-sm text-gray-400">上传图片，AI 识别内容并生成对应应用</p>
            </div>
            <div onClick={() => setActiveTab('voice')} className={`group relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 ${activeTab === 'voice' ? 'bg-gradient-to-br from-green-600 to-emerald-600 ring-2 ring-green-400' : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 ${activeTab === 'voice' ? 'bg-white/20' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">语音对话</h3>
              <p className="text-sm text-gray-400">说出你的需求，AI 语音识别并生成应用</p>
            </div>
          </div>

          {/* 输入区域 */}
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            {activeTab === 'text' && (
              <div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述你想要的应用，例如：帮我做一个计算器..." className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none" />
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-400">{user ? (user.is_pro ? 'Pro会员无限次' : `剩余 ${Math.max(0, 3 - (user.daily_count || 0))} 次`) : '登录后可使用'}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">生成格式：</span>
                      <button onClick={() => setOutputFormat('html')} className={`px-2 py-1 text-xs rounded transition ${outputFormat === 'html' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>HTML</button>
                      <button onClick={() => setOutputFormat('pdf')} className={`px-2 py-1 text-xs rounded transition ${outputFormat === 'pdf' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>PDF（打印保存）</button>
                    </div>
                  </div>
                  <button onClick={handleGenerateText} disabled={isGenerating || !user || (!user.is_pro && (user?.daily_count || 0) >= 6)} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 hover:from-blue-700 hover:to-purple-700 transition-all duration-200">{isGenerating ? '生成中...' : '生成应用'}</button>
                </div>
              </div>
            )}

            {activeTab === 'image' && (
              <div>
                <div className="flex flex-col items-center gap-4">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      <p className="text-sm text-gray-400">点击上传图片或拖拽</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                  {imagePreview && (
                    <div className="relative">
                      <img src={imagePreview} alt="预览" className="max-h-40 rounded-lg" />
                      <button onClick={() => { setImagePreview(null); setImageFile(null) }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  )}
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="补充描述（可选）" className="w-full h-20 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-400">{user ? (user.is_pro ? 'Pro会员无限次' : `剩余 ${Math.max(0, 3 - (user.daily_count || 0))} 次`) : '登录后可使用'}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">生成格式：</span>
                      <button onClick={() => setOutputFormat('html')} className={`px-2 py-1 text-xs rounded transition ${outputFormat === 'html' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>HTML</button>
                      <button onClick={() => setOutputFormat('pdf')} className={`px-2 py-1 text-xs rounded transition ${outputFormat === 'pdf' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>PDF（打印保存）</button>
                    </div>
                  </div>
                  <button onClick={handleGenerateImage} disabled={isGeneratingImage || !user || !imageFile || (!user.is_pro && (user?.daily_count || 0) >= 6)} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium disabled:opacity-50 hover:from-purple-700 hover:to-pink-700 transition-all duration-200">{isGeneratingImage ? '生成中...' : '生成应用'}</button>
                </div>
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="text-center py-8">
                <div className="flex justify-center gap-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={isGeneratingVoice || !user || (!user.is_pro && (user?.daily_count || 0) >= 6)}
                      className="w-24 h-24 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:scale-105 transition disabled:opacity-50"
                    >
                      <svg className="w-10 h-10 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="w-24 h-24 rounded-full bg-red-500 animate-pulse hover:scale-105 transition"
                    >
                      <svg className="w-10 h-10 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1" fill="white" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="mt-4 text-gray-400">
                  {isRecording ? '🎤 录音中... 点击停止' : '点击麦克风开始录音'}
                </p>
                {isGeneratingVoice && <p className="mt-2 text-blue-400">AI 识别中...</p>}
                <div className="flex items-center justify-center gap-3 mt-4">
                  <p className="text-sm text-gray-400">{user ? (user.is_pro ? 'Pro会员无限次' : `剩余 ${Math.max(0, 3 - (user.daily_count || 0))} 次`) : '登录后可使用'}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">生成格式：</span>
                    <button onClick={() => setOutputFormat('html')} className={`px-2 py-1 text-xs rounded transition ${outputFormat === 'html' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>HTML</button>
                    <button onClick={() => setOutputFormat('pdf')} className={`px-2 py-1 text-xs rounded transition ${outputFormat === 'pdf' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>PDF（打印保存）</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 生成结果预览 */}
          {generatedCode && (
            <div className="mt-8 bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">生成结果</h3>
                <div className="flex gap-2">
                  <button onClick={() => setPreviewCode(generatedCode)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">预览</button>
                  <button onClick={handleDownload} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition">下载 HTML</button>
                  {outputFormat === 'pdf' && (
                    <button onClick={() => { const printWindow = window.open('', '_blank'); if (printWindow) { printWindow.document.write(generatedCode); printWindow.document.close(); printWindow.print() } else { alert('请允许弹出窗口') } }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">打印/另存为PDF</button>
                  )}
                </div>
              </div>
              <div className="h-64 bg-gray-800 rounded-lg overflow-hidden">
                <iframe srcDoc={generatedCode} className="w-full h-full" title="预览" />
              </div>
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-md border-t border-white/10 py-3">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-center">
            <button onClick={() => setShowGames(true)} className="text-sm text-gray-400 hover:text-white transition">轻松时刻 ☕</button>
          </div>
        </footer>
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} onLoginSuccess={handleLoginSuccess} />
      <SideMenu isOpen={showMenu} onClose={() => setShowMenu(false)} user={user} onLogout={handleLogout} />

      {/* 游戏组件 */}
      {currentGame === 'snakePro' && <GameSnakePro onClose={() => setCurrentGame(null)} />}
      {currentGame === 'happyEliminate' && <GameHappyEliminate onClose={() => setCurrentGame(null)} />}
      {currentGame === 'eggParty' && <GameEggParty onClose={() => setCurrentGame(null)} />}

      {/* 游戏选择弹窗 */}
      {showGames && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowGames(false)} />
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl border border-white/10 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">轻松时刻</h2>
              <button onClick={() => setShowGames(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => { setShowGames(false); setCurrentGame('snakePro') }}
                className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                🐍 贪吃蛇美食大战
              </button>
              <button
                onClick={() => { setShowGames(false); setCurrentGame('happyEliminate') }}
                className="p-4 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl text-white font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                  🍬 开心消消乐
              </button>
              <button
                onClick={() => { setShowGames(false); setCurrentGame('eggParty') }}
                className="p-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl text-white font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
            >
              🥚 蛋仔派对
            </button>
          </div>
        </div>
      </div>
    )}
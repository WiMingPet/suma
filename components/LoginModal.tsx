'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  phone: string
  is_pro: boolean
  daily_count: number
}

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (user: User) => void
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入有效的手机号')
      return
    }

    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })

      const data = await res.json()

      if (data.success) {
        setCountdown(60)
        setError('')
        // 开发环境显示验证码（方便测试）
        if (data.devCode) {
          console.log(`[DEV] 验证码: ${data.devCode}`)
        }
      } else {
        setError(data.error || '发送失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setSending(false)
    }
  }

  const handleLogin = async () => {
    if (!phone || !code) {
      setError('请填写手机号和验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 调用新的登录 API（支持 JWT token）
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })

      const data = await res.json()

      if (data.success) {
        // 存储 JWT token（新版）
        localStorage.setItem('token', data.token)
        
        // 转换为旧版 User 格式，保持兼容性
        const user: User = {
          id: data.user.phone,  // 使用手机号作为 id
          phone: data.user.phone,
          is_pro: data.user.is_pro || false,
          daily_count: data.user.daily_count || 3
        }
        
        // 同时存储旧格式，兼容已有功能
        localStorage.setItem('suma_user', JSON.stringify(user))
        
        onLoginSuccess(user)
        onClose()
      } else {
        setError(data.error || '登录失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 w-full max-w-md mx-4 transform transition-all duration-300 scale-100 opacity-100 shadow-2xl border border-white/10">
        {/* 装饰光效 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 rounded-full blur-3xl" />
        
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          欢迎回来
        </h2>
        <p className="text-gray-400 text-center mb-6">
          输入手机号获取验证码登录
        </p>

        <div className="space-y-4">
          {/* 手机号输入 */}
          <div className="group">
            <label className="block text-gray-400 mb-2 text-sm">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl 
                         text-white placeholder-gray-500
                         focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                         transition-all duration-200"
              maxLength={11}
            />
          </div>

          {/* 验证码输入 */}
          <div>
            <label className="block text-gray-400 mb-2 text-sm">验证码</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入验证码"
                className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl 
                           text-white placeholder-gray-500
                           focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                           transition-all duration-200"
                maxLength={6}
              />
              <button
                onClick={handleSendCode}
                disabled={countdown > 0 || sending}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 
                           text-white rounded-xl font-medium
                           hover:from-blue-700 hover:to-purple-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="text-red-500 text-sm animate-shake">{error}</p>
          )}

          {/* 登录按钮 */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 
                       text-white rounded-xl font-semibold
                       hover:from-blue-700 hover:to-purple-700
                       disabled:opacity-50
                       transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                       relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="loading-dots">
                    <span></span><span></span><span></span>
                  </span>
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </span>
            {!loading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                              translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            )}
          </button>
        </div>

        <p className="text-gray-500 text-xs text-center mt-6">
          未注册的用户将自动创建账号
        </p>
      </div>
    </div>
  )
}
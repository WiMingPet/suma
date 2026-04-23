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

type LoginMode = 'code' | 'password' | 'register'

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  // UI 状态
  const [loginMode, setLoginMode] = useState<LoginMode>('code')
  const [isForgotMode, setIsForgotMode] = useState(false)
  
  // 表单字段
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  
  // 注册表单字段
  const [registerPhone, setRegisterPhone] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
  const [registerCode, setRegisterCode] = useState('')
  
  // UI 状态
  const [countdown, setCountdown] = useState(0)
  const [registerCountdown, setRegisterCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  useEffect(() => {
    if (registerCountdown > 0) {
      const timer = setTimeout(() => setRegisterCountdown(registerCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [registerCountdown])

  // 重置表单
  const resetForm = () => {
    setPhone('')
    setCode('')
    setPassword('')
    setNewPassword('')
    setRegisterPhone('')
    setRegisterPassword('')
    setRegisterConfirmPassword('')
    setRegisterCode('')
    setError('')
    setLoading(false)
    setSending(false)
  }

  const handleClose = () => {
    resetForm()
    setLoginMode('code')
    setIsForgotMode(false)
    onClose()
  }

  // ========== 发送验证码 ==========
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
        if (data.devCode) {
          console.log(`[DEV] 验证码: ${data.devCode}`)
          alert(`开发环境验证码: ${data.devCode}`)
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

  // ========== 发送注册验证码 ==========
  const handleRegisterSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(registerPhone)) {
      setError('请输入有效的手机号')
      return
    }

    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: registerPhone })
      })

      const data = await res.json()

      if (data.success) {
        setRegisterCountdown(60)
        setError('')
        if (data.devCode) {
          console.log(`[DEV] 注册验证码: ${data.devCode}`)
          alert(`开发环境验证码: ${data.devCode}`)
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

  // ========== 验证码登录 ==========
  const handleCodeLogin = async () => {
    if (!phone || !code) {
      setError('请填写手机号和验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })

      const data = await res.json()

      if (data.success) {
        // 保存 token 和用户信息
        localStorage.setItem('token', data.token)
        localStorage.setItem('suma_user', JSON.stringify(data.user))
        onLoginSuccess(data.user)
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

  // ========== 密码登录 ==========
  const handlePasswordLogin = async () => {
    if (!phone || !password) {
      setError('请填写手机号和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      })

      const data = await res.json()

      if (data.success) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('suma_user', JSON.stringify(data.user))
        onLoginSuccess(data.user)
        onClose()
      } else {
        setError(data.error || '手机号或密码错误')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // ========== 注册新账号 ==========
  const handleRegister = async () => {
    // 验证手机号
    if (!/^1[3-9]\d{9}$/.test(registerPhone)) {
      setError('请输入正确的手机号')
      return
    }
    
    // 验证密码
    if (!registerPassword || registerPassword.length < 6) {
      setError('密码长度不能少于6位')
      return
    }
    
    // 验证确认密码
    if (registerPassword !== registerConfirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    
    // 验证验证码
    if (!registerCode) {
      setError('请输入验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: registerPhone,
          password: registerPassword,
          code: registerCode
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert('注册成功！请使用密码登录')
        // 切换到密码登录Tab，并自动填充手机号
        setLoginMode('password')
        setPhone(registerPhone)
        setPassword('')
        setRegisterPhone('')
        setRegisterPassword('')
        setRegisterConfirmPassword('')
        setRegisterCode('')
        setError('')
      } else {
        setError(data.error || '注册失败')
      }
    } catch (err) {
      setError('注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // ========== 忘记密码：发送验证码 ==========
  const handleForgotSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入有效的手机号')
      return
    }

    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })

      const data = await res.json()

      if (data.success) {
        setCountdown(60)
        setError('')
        if (data.devCode) {
          console.log(`[DEV] 重置验证码: ${data.devCode}`)
          alert(`开发环境验证码: ${data.devCode}`)
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

  // ========== 重置密码 ==========
  const handleResetPassword = async () => {
    if (!phone || !code || !newPassword) {
      setError('请填写手机号、验证码和新密码')
      return
    }
    if (newPassword.length < 6) {
      setError('密码长度至少6位')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, newPassword })
      })

      const data = await res.json()

      if (data.success) {
        alert('密码重置成功，请使用新密码登录')
        setIsForgotMode(false)
        setLoginMode('password')
        setCode('')
        setNewPassword('')
        setPassword('')
      } else {
        setError(data.error || '重置失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // ========== 忘记密码界面 ==========
  if (isForgotMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 w-full max-w-md mx-4 border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 rounded-full blur-3xl" />
          
          <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
          
          <h2 className="text-2xl font-bold text-white mb-2 text-center">重置密码</h2>
          <p className="text-gray-400 text-center mb-6">输入手机号获取验证码，设置新密码</p>

          <div className="space-y-4">
            <div className="group">
              <label className="block text-gray-400 mb-2 text-sm">手机号</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" maxLength={11} />
            </div>

            <div>
              <label className="block text-gray-400 mb-2 text-sm">验证码</label>
              <div className="flex gap-3">
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入验证码" className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" maxLength={6} />
                <button onClick={handleForgotSendCode} disabled={countdown > 0 || sending} className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50">{countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'}</button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 mb-2 text-sm">新密码</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少6位" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button onClick={handleResetPassword} disabled={loading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold disabled:opacity-50">{loading ? '处理中...' : '确认重置'}</button>
            
            <button onClick={() => { setIsForgotMode(false); setError(''); setCode(''); setNewPassword(''); }} className="w-full text-center text-gray-400 text-sm hover:text-white transition">返回登录</button>
          </div>
        </div>
      </div>
    )
  }

  // ========== 注册界面 ==========
  if (loginMode === 'register') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        
        <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 w-full max-w-md mx-4 transform transition-all duration-300 scale-100 opacity-100 shadow-2xl border border-white/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 rounded-full blur-3xl" />
          
          <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-2xl font-bold text-white mb-2 text-center">注册新账号</h2>
          <p className="text-gray-400 text-center mb-6">填写信息，立即注册</p>

          {/* Tab 切换 */}
          <div className="flex gap-2 mb-6 bg-gray-800/50 rounded-xl p-1">
            <button onClick={() => { setLoginMode('code'); setError(''); }} className="flex-1 py-2 rounded-lg transition text-gray-400">验证码登录</button>
            <button onClick={() => { setLoginMode('password'); setError(''); }} className="flex-1 py-2 rounded-lg transition text-gray-400">密码登录</button>
            <button onClick={() => { setLoginMode('register'); setError(''); }} className="flex-1 py-2 rounded-lg transition bg-blue-600 text-white">注册</button>
          </div>

          <div className="space-y-4">
            {/* 手机号 */}
            <div className="group">
              <label className="block text-gray-400 mb-2 text-sm">手机号</label>
              <input 
                type="tel" 
                value={registerPhone} 
                onChange={(e) => setRegisterPhone(e.target.value)} 
                placeholder="请输入手机号" 
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" 
                maxLength={11} 
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-gray-400 mb-2 text-sm">密码</label>
              <input 
                type="password" 
                value={registerPassword} 
                onChange={(e) => setRegisterPassword(e.target.value)} 
                placeholder="至少6位" 
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" 
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-gray-400 mb-2 text-sm">确认密码</label>
              <input 
                type="password" 
                value={registerConfirmPassword} 
                onChange={(e) => setRegisterConfirmPassword(e.target.value)} 
                placeholder="请再次输入密码" 
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" 
              />
            </div>

            {/* 验证码 */}
            <div>
              <label className="block text-gray-400 mb-2 text-sm">验证码</label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={registerCode} 
                  onChange={(e) => setRegisterCode(e.target.value)} 
                  placeholder="请输入验证码" 
                  className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" 
                  maxLength={6} 
                />
                <button 
                  onClick={handleRegisterSendCode} 
                  disabled={registerCountdown > 0 || sending} 
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 whitespace-nowrap"
                >
                  {registerCountdown > 0 ? `${registerCountdown}s` : sending ? '发送中' : '获取验证码'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* 注册按钮 */}
            <button 
              onClick={handleRegister} 
              disabled={loading} 
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? '注册中...' : '立即注册'}
              </span>
              {!loading && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              )}
            </button>

            {/* 返回登录 */}
            <button 
              onClick={() => { 
                setLoginMode('password'); 
                setError(''); 
                setRegisterPhone('');
                setRegisterPassword('');
                setRegisterConfirmPassword('');
                setRegisterCode('');
              }} 
              className="w-full text-center text-gray-400 text-sm hover:text-white transition"
            >
              已有账号？返回登录
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========== 正常登录界面 ==========
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 w-full max-w-md mx-4 transform transition-all duration-300 scale-100 opacity-100 shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 rounded-full blur-3xl" />
        
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-white mb-2 text-center">欢迎回来</h2>
        <p className="text-gray-400 text-center mb-6">登录你的账号</p>

        {/* Tab 切换 */}
        <div className="flex gap-2 mb-6 bg-gray-800/50 rounded-xl p-1">
          <button onClick={() => { setLoginMode('code'); setError(''); }} className={`flex-1 py-2 rounded-lg transition ${loginMode === 'code' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>验证码登录</button>
          <button onClick={() => { setLoginMode('password'); setError(''); }} className={`flex-1 py-2 rounded-lg transition ${loginMode === 'password' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>密码登录</button>
          <button onClick={() => { setLoginMode('register'); setError(''); }} className={`flex-1 py-2 rounded-lg transition ${loginMode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>注册</button>
        </div>

        <div className="space-y-4">
          {/* 手机号输入 */}
          <div className="group">
            <label className="block text-gray-400 mb-2 text-sm">手机号</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" maxLength={11} />
          </div>

          {/* 验证码或密码输入 */}
          {loginMode === 'code' ? (
            <div>
              <label className="block text-gray-400 mb-2 text-sm">验证码</label>
              <div className="flex gap-3">
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入验证码" className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" maxLength={6} />
                <button onClick={handleSendCode} disabled={countdown > 0 || sending} className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 whitespace-nowrap">{countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'}</button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-gray-400 mb-2 text-sm">密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* 登录按钮 */}
          <button onClick={loginMode === 'code' ? handleCodeLogin : handlePasswordLogin} disabled={loading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group">
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? '登录中...' : '登录'}
            </span>
            {!loading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            )}
          </button>

          {/* 忘记密码链接 */}
          {loginMode === 'password' && (
            <button onClick={() => { setIsForgotMode(true); setError(''); setCode(''); }} className="w-full text-center text-gray-400 text-sm hover:text-white transition">忘记密码？</button>
          )}
        </div>

        <p className="text-gray-500 text-xs text-center mt-6">未注册的用户将自动创建账号</p>
      </div>
    </div>
  )
}
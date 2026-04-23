'use client'

import { useState, useEffect } from 'react'
import AppCard from './AppCard'

interface User {
  id: string
  phone: string
  is_pro: boolean
  daily_count: number
}

interface SideMenuProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onLogout: () => void
}

interface SavedApp {
  id: string
  name: string
  code: string
  type: string
  created_at: string
}

export default function SideMenu({ isOpen, onClose, user, onLogout }: SideMenuProps) {
  const [activeTab, setActiveTab] = useState<'apps' | 'favorites'>('apps')
  const [apps, setApps] = useState<SavedApp[]>([])
  const [favorites, setFavorites] = useState<SavedApp[]>([])
  const [loading, setLoading] = useState(false)
  const [previewCode, setPreviewCode] = useState<string | null>(null)

  const loadApps = () => {
    if (!user) return
    setLoading(true)
    try {
      const storedApps = localStorage.getItem(`suma_apps_${user.id}`)
      const appsList = storedApps ? JSON.parse(storedApps) : []
      setApps(appsList)
      console.log('加载应用:', appsList.length)
    } catch (err) {
      console.error('加载应用失败', err)
    } finally {
      setLoading(false)
    }
  }

  const loadFavorites = () => {
    if (!user) return
    setLoading(true)
    try {
      const storedFavorites = localStorage.getItem(`suma_favorites_${user.id}`)
      const favoriteIds = storedFavorites ? JSON.parse(storedFavorites) : []
      const storedApps = localStorage.getItem(`suma_apps_${user.id}`)
      const allApps = storedApps ? JSON.parse(storedApps) : []
      const favoriteApps = allApps.filter(app => favoriteIds.includes(app.id))
      setFavorites(favoriteApps)
    } catch (err) {
      console.error('加载收藏失败', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && user) {
      loadApps()
      loadFavorites()
    }
  }, [isOpen, user])

  const handleDelete = (appId: string) => {
    if (!user) return
    try {
      const storedApps = localStorage.getItem(`suma_apps_${user.id}`)
      let appsList = storedApps ? JSON.parse(storedApps) : []
      appsList = appsList.filter((app: SavedApp) => app.id !== appId)
      localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(appsList))
      
      const storedFavorites = localStorage.getItem(`suma_favorites_${user.id}`)
      let favoritesList = storedFavorites ? JSON.parse(storedFavorites) : []
      favoritesList = favoritesList.filter((id: string) => id !== appId)
      localStorage.setItem(`suma_favorites_${user.id}`, JSON.stringify(favoritesList))
      
      loadApps()
      loadFavorites()
    } catch (err) {
      alert('删除失败')
    }
  }

  const handleToggleFavorite = (appId: string, isFavorite: boolean) => {
    if (!user) return
    try {
      const storedFavorites = localStorage.getItem(`suma_favorites_${user.id}`)
      let favoritesList = storedFavorites ? JSON.parse(storedFavorites) : []
      
      if (isFavorite) {
        if (!favoritesList.includes(appId)) {
          favoritesList.push(appId)
        }
      } else {
        favoritesList = favoritesList.filter((id: string) => id !== appId)
      }
      localStorage.setItem(`suma_favorites_${user.id}`, JSON.stringify(favoritesList))
      
      loadApps()
      loadFavorites()
    } catch (err) {
      alert('操作失败')
    }
  }

  const handleDownload = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  const currentItems = activeTab === 'apps' ? apps : favorites
  const emptyMessage = activeTab === 'apps' ? '暂无应用，快去生成一个吧' : '暂无收藏，去我的应用中收藏喜欢的应用吧'

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed top-0 left-0 bottom-0 z-50 w-80 bg-gray-900 shadow-2xl flex flex-col">
        {/* 头部 - 手机号 + 退出按钮 */}
        <div className="p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">我的空间</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 transition">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {user.phone.slice(-2)}
                </div>
                <div>
                  <p className="text-white font-medium">{user.phone.slice(0, 3)}****{user.phone.slice(-4)}</p>
                  <p className="text-xs text-gray-400">
                    {user.is_pro ? 'Pro会员' : `剩余 ${3 - (user.daily_count || 0)} 次`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onLogout()
                  onClose()
                }}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition"
              >
                退出
              </button>
            </div>
          )}
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          <button
            onClick={() => setActiveTab('apps')}
            className={`flex-1 py-3 text-center transition ${
              activeTab === 'apps'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              📱 我的应用
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{apps.length}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-3 text-center transition ${
              activeTab === 'favorites'
                ? 'text-pink-400 border-b-2 border-pink-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              ❤️ 我的收藏
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{favorites.length}</span>
            </span>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="loading-dots"><span></span><span></span><span></span></div>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-500 text-sm">{emptyMessage}</p>
            </div>
          ) : (
            currentItems.map(app => (
              <AppCard
                key={app.id}
                app={app}
                isFavorite={favorites.some(f => f.id === app.id)}
                onPreview={(code) => setPreviewCode(code)}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))
          )}
        </div>
      </div>

      {previewCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPreviewCode(null)} />
          <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-lg overflow-hidden shadow-2xl">
            <button onClick={() => setPreviewCode(null)} className="absolute top-4 right-4 z-10 bg-gray-900/80 hover:bg-gray-900 text-white p-2 rounded-full transition">
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
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router' 
import AppCard from './AppCard'

import { useUser } from '../contexts/UserContext'

interface SideMenuProps {
  isOpen: boolean
  onClose: () => void
}

interface SavedApp {
  id: string
  name: string
  code: string
  type: string
  created_at: string
}

interface TaskItem {
  id: string
  type: string
  status: string
  name: string
  createdAt: string
  updatedAt: string
}

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const { user, logout } = useUser();
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'apps' | 'favorites' | 'tasks'>('apps')
  const [apps, setApps] = useState<SavedApp[]>([])
  const [favorites, setFavorites] = useState<SavedApp[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [previewCode, setPreviewCode] = useState<string | null>(null)

  const goToMemberCenter = () => {
    onClose()
    router.push('/member-center')
  }

  // ========== 从服务器加载应用列表 ==========
  const loadApps = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`https://sumaai.cn/api/saved-apps?userId=${user.id}`, {
        headers: { 'x-user-id': user.id }
      })
      const data = await res.json()
      if (data.success) {
        setApps(data.apps || [])
        localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(data.apps || []))
      } else {
        loadAppsFromLocal()
      }
    } catch (err) {
      console.error('加载应用失败:', err)
      loadAppsFromLocal()
    } finally {
      setLoading(false)
    }
  }

  const loadAppsFromLocal = () => {
    if (!user) return
    try {
      const storedApps = localStorage.getItem(`suma_apps_${user.id}`)
      setApps(storedApps ? JSON.parse(storedApps) : [])
    } catch (err) {
      setApps([])
    }
  }

  // ========== 加载任务列表 ==========
  const loadTasks = async () => {
    if (!user) return
    try {
      const res = await fetch(`https://sumaai.cn/api/tasks?userId=${user.id}`, {
        headers: { 'x-user-id': user.id }
      })
      const data = await res.json()
      if (data.success) {
        setTasks(data.tasks || [])
      }
    } catch (err) {
      console.error('加载任务失败:', err)
    }
  }

  // ========== 加载收藏列表 ==========
  const loadFavorites = () => {
    if (!user) return
    try {
      const storedFavorites = localStorage.getItem(`suma_favorites_${user.id}`)
      const favoriteIds = storedFavorites ? JSON.parse(storedFavorites) : []
      const favoriteApps = apps.filter(app => favoriteIds.includes(app.id))
      setFavorites(favoriteApps)
    } catch (err) {
      console.error('加载收藏失败', err)
    }
  }

  useEffect(() => {
    if (isOpen && user) {
      loadApps()
      loadTasks()
    }
  }, [isOpen, user])

  useEffect(() => {
    loadFavorites()
  }, [apps])

  // ========== 删除应用 ==========
  const handleDelete = async (appId: string) => {
    if (!user) return
    try {
      await fetch('https://sumaai.cn/api/saved-apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ id: appId })
      })

      const storedApps = localStorage.getItem(`suma_apps_${user.id}`)
      let appsList = storedApps ? JSON.parse(storedApps) : []
      appsList = appsList.filter((app: SavedApp) => app.id !== appId)
      localStorage.setItem(`suma_apps_${user.id}`, JSON.stringify(appsList))

      const storedFavorites = localStorage.getItem(`suma_favorites_${user.id}`)
      let favoritesList = storedFavorites ? JSON.parse(storedFavorites) : []
      favoritesList = favoritesList.filter((id: string) => id !== appId)
      localStorage.setItem(`suma_favorites_${user.id}`, JSON.stringify(favoritesList))

      setApps(prev => prev.filter(app => app.id !== appId))
      setFavorites(prev => prev.filter(app => app.id !== appId))
    } catch (err) {
      alert('删除失败，请稍后重试')
    }
  }

  const handleToggleFavorite = (appId: string, isFavorite: boolean) => {
    if (!user) return
    try {
      const storedFavorites = localStorage.getItem(`suma_favorites_${user.id}`)
      let favoritesList = storedFavorites ? JSON.parse(storedFavorites) : []
      if (isFavorite) {
        if (!favoritesList.includes(appId)) favoritesList.push(appId)
      } else {
        favoritesList = favoritesList.filter((id: string) => id !== appId)
      }
      localStorage.setItem(`suma_favorites_${user.id}`, JSON.stringify(favoritesList))
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

  const getCurrentItems = () => {
    if (activeTab === 'apps') return apps
    if (activeTab === 'favorites') return favorites
    return tasks
  }

  const getEmptyMessage = () => {
    if (activeTab === 'apps') return '暂无应用，快去生成一个吧'
    if (activeTab === 'favorites') return '暂无收藏'
    return '暂无生成任务'
  }

  const currentItems = getCurrentItems()
  const emptyMessage = getEmptyMessage()

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="fixed top-0 left-0 bottom-0 z-50 w-80 bg-gray-900 shadow-2xl flex flex-col">
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
                <div onClick={goToMemberCenter} className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold cursor-pointer hover:opacity-80 transition">
                  {user.phone.slice(-2)}
                </div>
                <div onClick={goToMemberCenter} className="cursor-pointer hover:bg-white/5 transition rounded-lg p-2 -m-2">
                  <p className="text-white font-medium">{user.phone.slice(0, 3)}****{user.phone.slice(-4)}</p>
                  <p className="text-xs text-gray-400">
                    {user.is_pro ? `点币余额: ${user.points || 0}` : `剩余免费次数: ${Math.max(0, 3 - (user.free_used || 0))}`}
                  </p>
                </div>
              </div>
              <button onClick={() => { logout(); onClose() }} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition">
                退出
              </button>
            </div>
          )}
        </div>

        <button onClick={() => {
          alert('📞 客服联系方式：\n\n邮箱：3060302415@qq.com\n电话：15920978058\n工作时间：9:00-18:00\n\n我们会尽快回复您的问题。')
        }} className="flex items-center justify-between px-4 py-3 mx-3 my-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition border border-blue-500/20">
          <div className="flex items-center gap-3">
            <span className="text-xl">💬</span>
            <div className="text-left">
              <p className="text-white font-medium">帮助与客服</p>
              <p className="text-xs text-gray-400">遇到问题？联系我们</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 三个 Tab */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          <button onClick={() => setActiveTab('apps')} className={`flex-1 py-3 text-center transition ${activeTab === 'apps' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}>
            <span className="flex items-center justify-center gap-2">
              📱 我的应用
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{apps.length}</span>
            </span>
          </button>
          <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-3 text-center transition ${activeTab === 'favorites' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-gray-400 hover:text-gray-300'}`}>
            <span className="flex items-center justify-center gap-2">
              ❤️ 我的收藏
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{favorites.length}</span>
            </span>
          </button>
          <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-3 text-center transition ${activeTab === 'tasks' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-gray-300'}`}>
            <span className="flex items-center justify-center gap-2">
              ⏳ 任务
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
            </span>
          </button>
        </div>

        {/* 内容区 */}
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
          ) : activeTab === 'tasks' ? (
            currentItems.map((task: any) => (
              <div key={task.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm truncate flex-1">{task.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                    task.status === 'completed' ? 'bg-green-600 text-white' :
                    task.status === 'processing' ? 'bg-yellow-600 text-white animate-pulse' :
                    'bg-red-600 text-white'
                  }`}>
                    {task.status === 'completed' ? '✅ 完成' :
                     task.status === 'processing' ? '⏳ 生成中' :
                     '❌ 失败'}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {new Date(task.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            currentItems.map((app: any) => (
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
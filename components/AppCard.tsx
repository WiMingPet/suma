'use client'

interface AppCardProps {
  app: {
    id: string
    name: string
    code: string
    type: string
    created_at: string
  }
  isFavorite?: boolean
  onPreview: (code: string) => void
  onDownload: (code: string, name: string) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string, isFavorite: boolean) => void
}

export default function AppCard({ app, isFavorite = false, onPreview, onDownload, onDelete, onToggleFavorite }: AppCardProps) {
  const typeIcon = {
    text: '📝',
    image: '🖼️',
    voice: '🎤'
  }[app.type] || '📄'

  const typeName = {
    text: '文字生成',
    image: '图片识别',
    voice: '语音对话'
  }[app.type] || '应用'

  return (
    <div 
      className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 hover:border-gray-600 transition-all duration-200 cursor-pointer"
      onClick={() => onPreview(app.code)}
    >
      <div className="flex items-center gap-3">
        {/* 图标 */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xl flex-shrink-0">
          {typeIcon}
        </div>
        
        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm truncate">{app.name}</h3>
          <p className="text-xs text-gray-500">{typeName} · {new Date(app.created_at).toLocaleDateString()}</p>
        </div>
        
        {/* 按钮组 */}
        <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleFavorite(app.id, !isFavorite)}
            className="p-1.5 rounded-lg hover:bg-gray-700 transition"
            title={isFavorite ? '取消收藏' : '收藏'}
          >
            <span className="text-base">{isFavorite ? '❤️' : '🤍'}</span>
          </button>
          <button
            onClick={() => onPreview(app.code)}
            className="p-1.5 rounded-lg hover:bg-gray-700 transition"
            title="预览"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={() => onDownload(app.code, app.name)}
            className="p-1.5 rounded-lg hover:bg-gray-700 transition"
            title="下载"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(app.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/20 transition"
            title="删除"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
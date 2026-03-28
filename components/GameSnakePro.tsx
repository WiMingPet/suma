'use client'

import { useEffect, useRef, useState } from 'react'

interface GameSnakeProProps {
  onClose: () => void
}

const GRID_SIZE = 20
const CELL_SIZE = 20
const INIT_SNAKE = [[10, 10], [9, 10], [8, 10], [7, 10]]
const INIT_DIR = 'RIGHT'

export default function GameSnakePro({ onClose }: GameSnakeProProps) {
  const [snake, setSnake] = useState(INIT_SNAKE)
  const [food, setFood] = useState<[number, number]>([15, 10])
  const [direction, setDirection] = useState(INIT_DIR)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [gameOver, setGameOver] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)

  // 音效模拟
  const playSound = (type: 'eat' | 'die') => {
    if (typeof window === 'undefined') return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      if (type === 'eat') {
        osc.frequency.value = 800
        gain.gain.value = 0.2
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2)
        osc.stop(ctx.currentTime + 0.2)
      } else {
        osc.frequency.value = 200
        gain.gain.value = 0.3
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
        osc.stop(ctx.currentTime + 0.5)
      }
      setTimeout(() => ctx.close(), 600)
    } catch (e) {}
  }

  // 游戏逻辑
  useEffect(() => {
    if (!isPlaying || gameOver || isPaused) return
    gameLoopRef.current = setInterval(() => {
      setSnake(prev => {
        const head = prev[0]
        let newHead: [number, number]
        switch (direction) {
          case 'UP': newHead = [head[0], head[1] - 1]; break
          case 'DOWN': newHead = [head[0], head[1] + 1]; break
          case 'LEFT': newHead = [head[0] - 1, head[1]]; break
          default: newHead = [head[0] + 1, head[1]]
        }
        // 边界碰撞
        if (newHead[0] < 0 || newHead[0] >= GRID_SIZE || newHead[1] < 0 || newHead[1] >= GRID_SIZE) {
          setGameOver(true)
          setIsPlaying(false)
          playSound('die')
          if (gameLoopRef.current) clearInterval(gameLoopRef.current)
          return prev
        }
        const isEating = newHead[0] === food[0] && newHead[1] === food[1]
        let newSnake = [newHead, ...prev]
        if (!isEating) newSnake.pop()
        // 自碰
        if (newSnake.slice(1).some(seg => seg[0] === newHead[0] && seg[1] === newHead[1])) {
          setGameOver(true)
          setIsPlaying(false)
          playSound('die')
          if (gameLoopRef.current) clearInterval(gameLoopRef.current)
          return prev
        }
        if (isEating) {
          playSound('eat')
          setScore(s => s + 10)
          // 新食物
          let newFood: [number, number]
          do {
            newFood = [Math.floor(Math.random() * GRID_SIZE), Math.floor(Math.random() * GRID_SIZE)]
          } while (newSnake.some(seg => seg[0] === newFood[0] && seg[1] === newFood[1]))
          setFood(newFood)
          if ((score + 10) % 100 === 0) setLevel(l => l + 1)
        }
        return newSnake
      })
    }, 150 - (level - 1) * 5)
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current) }
  }, [isPlaying, gameOver, isPaused, direction, food, score, level])

  // 键盘控制
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver || isPaused) return
      const key = e.key
      const newDir = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' }[key]
      if (newDir) {
        const opposite = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
        if (opposite[newDir as keyof typeof opposite] !== direction) {
          setDirection(newDir)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPlaying, gameOver, isPaused, direction])

  const startGame = () => {
    setSnake(INIT_SNAKE)
    setDirection(INIT_DIR)
    setFood([15, 10])
    setScore(0)
    setLevel(1)
    setGameOver(false)
    setIsPlaying(true)
    setIsPaused(false)
  }

  const togglePause = () => {
    if (!isPlaying || gameOver) return
    setIsPaused(p => !p)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">贪吃蛇美食大战</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex justify-between text-white mb-2">
          <span>得分: {score}</span>
          <span>等级: {level}</span>
        </div>
        <div className="bg-gray-800 rounded-lg p-2 flex justify-center">
          <div className="grid grid-cols-20 gap-0.5 bg-gray-700 p-1 rounded" style={{ width: GRID_SIZE * (CELL_SIZE+2), height: GRID_SIZE * (CELL_SIZE+2) }}>
            {Array.from({ length: GRID_SIZE }).map((_, y) => (
              Array.from({ length: GRID_SIZE }).map((_, x) => {
                const isSnake = snake.some(seg => seg[0] === x && seg[1] === y)
                const isFood = food[0] === x && food[1] === y
                return (
                  <div
                    key={`${x}-${y}`}
                    className="w-5 h-5 rounded-sm"
                    style={{
                      backgroundColor: isSnake ? '#4ade80' : isFood ? '#facc15' : '#2d2d3a',
                      boxShadow: isSnake ? '0 0 4px #4ade80' : 'none'
                    }}
                  />
                )
              })
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          {!isPlaying && !gameOver && (
            <button onClick={startGame} className="flex-1 py-2 bg-green-600 rounded-lg text-white">开始游戏</button>
          )}
          {isPlaying && !gameOver && (
            <button onClick={togglePause} className="flex-1 py-2 bg-yellow-600 rounded-lg text-white">{isPaused ? '继续' : '暂停'}</button>
          )}
          {gameOver && (
            <button onClick={startGame} className="flex-1 py-2 bg-red-600 rounded-lg text-white">重新开始</button>
          )}
        </div>
        <p className="text-gray-500 text-xs text-center mt-4">键盘方向键控制 | 自动加速 | 每100分升1级</p>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface GameSnakeProps {
  onClose: () => void
}

const GRID_SIZE = 20
const CELL_SIZE = 20
const INITIAL_SNAKE = [
  [10, 10],
  [9, 10],
  [8, 10],
  [7, 10]
]
const INITIAL_DIRECTION = 'RIGHT'

export default function GameSnake({ onClose }: GameSnakeProps) {
  const [snake, setSnake] = useState(INITIAL_SNAKE)
  const [direction, setDirection] = useState(INITIAL_DIRECTION)
  const [food, setFood] = useState<[number, number]>([15, 10])
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)

  // 生成新食物
  const generateFood = useCallback(() => {
    const newFood: [number, number] = [
      Math.floor(Math.random() * GRID_SIZE),
      Math.floor(Math.random() * GRID_SIZE)
    ]
    if (snake.some(segment => segment[0] === newFood[0] && segment[1] === newFood[1])) {
      generateFood()
    } else {
      setFood(newFood)
    }
  }, [snake])

  // 移动蛇
  const moveSnake = useCallback(() => {
    if (gameOver || !isPlaying || isPaused) return

    setSnake(prevSnake => {
      const newSnake = [...prevSnake]
      const head = newSnake[0]
      let newHead: [number, number]

      switch (direction) {
        case 'UP': newHead = [head[0], head[1] - 1]; break
        case 'DOWN': newHead = [head[0], head[1] + 1]; break
        case 'LEFT': newHead = [head[0] - 1, head[1]]; break
        case 'RIGHT': newHead = [head[0] + 1, head[1]]; break
        default: return prevSnake
      }

      const isEating = newHead[0] === food[0] && newHead[1] === food[1]

      if (isEating) {
        setScore(s => s + 10)
        generateFood()
        return [newHead, ...newSnake]
      } else {
        newSnake.unshift(newHead)
        newSnake.pop()
      }

      // 碰撞检测
      const hitWall = newHead[0] < 0 || newHead[0] >= GRID_SIZE || newHead[1] < 0 || newHead[1] >= GRID_SIZE
      const hitSelf = newSnake.slice(1).some(segment => segment[0] === newHead[0] && segment[1] === newHead[1])

      if (hitWall || hitSelf) {
        setGameOver(true)
        setIsPlaying(false)
        if (gameLoopRef.current) clearInterval(gameLoopRef.current)
        return prevSnake
      }

      return newSnake
    })
  }, [direction, food, gameOver, isPlaying, isPaused, generateFood])

  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault()
        setIsPaused(p => !p)
        return
      }
      const keyMap: Record<string, string> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT'
      }
      const newDir = keyMap[e.key]
      if (newDir) {
        e.preventDefault()
        const opposite: Record<string, string> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
        if (opposite[newDir] !== direction) {
          setDirection(newDir)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [direction, isPlaying, gameOver])

  // 游戏循环
  useEffect(() => {
    if (isPlaying && !gameOver && !isPaused) {
      gameLoopRef.current = setInterval(moveSnake, 150)
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    }
  }, [isPlaying, gameOver, isPaused, moveSnake])

  const startGame = () => {
    setSnake(INITIAL_SNAKE)
    setDirection(INITIAL_DIRECTION)
    setFood([15, 10])
    setScore(0)
    setGameOver(false)
    setIsPaused(false)
    setIsPlaying(true)
  }

  const handleDirection = (dir: string) => {
    if (!isPlaying || gameOver || isPaused) return
    const opposite: Record<string, string> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
    if (opposite[dir] !== direction) {
      setDirection(dir)
    }
  }

  const togglePause = () => {
    if (isPlaying && !gameOver) setIsPaused(p => !p)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">贪吃蛇</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="text-white">得分: <span className="text-yellow-400 text-xl">{score}</span></p>
          <div className="flex gap-2">
            {isPlaying && !gameOver && (
              <button onClick={togglePause} className="px-3 py-1 bg-gray-700 rounded-lg text-white text-sm">
                {isPaused ? '继续' : '暂停'}
              </button>
            )}
            {(!isPlaying || gameOver) && (
              <button onClick={startGame} className="px-4 py-2 bg-green-600 rounded-lg text-white">
                {gameOver ? '重新开始' : '开始游戏'}
              </button>
            )}
          </div>
        </div>

        {/* 画布 */}
        <div className="bg-gray-800 rounded-lg p-2 flex justify-center">
          <div className="relative" style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE, backgroundColor: '#1f2937' }}>
            {snake.map((seg, i) => (
              <div key={i} className="absolute bg-green-500 rounded-sm" style={{ width: CELL_SIZE-2, height: CELL_SIZE-2, left: seg[0]*CELL_SIZE+1, top: seg[1]*CELL_SIZE+1 }} />
            ))}
            <div className="absolute bg-red-500 rounded-full" style={{ width: CELL_SIZE-4, height: CELL_SIZE-4, left: food[0]*CELL_SIZE+2, top: food[1]*CELL_SIZE+2 }} />
          </div>
        </div>

        {/* 触屏方向键 */}
        {isPlaying && !gameOver && (
          <div className="grid grid-cols-3 gap-2 mt-6 max-w-[200px] mx-auto">
            <div></div>
            <button onClick={() => handleDirection('UP')} className="p-3 bg-gray-700 rounded-lg text-white text-xl">↑</button>
            <div></div>
            <button onClick={() => handleDirection('LEFT')} className="p-3 bg-gray-700 rounded-lg text-white text-xl">←</button>
            <button onClick={() => handleDirection('DOWN')} className="p-3 bg-gray-700 rounded-lg text-white text-xl">↓</button>
            <button onClick={() => handleDirection('RIGHT')} className="p-3 bg-gray-700 rounded-lg text-white text-xl">→</button>
          </div>
        )}
        <p className="text-gray-500 text-xs text-center mt-4">键盘方向键 | 空格暂停</p>
      </div>
    </div>
  )
}
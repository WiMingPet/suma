'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface GameTetrisProps { onClose: () => void }

const BOARD_WIDTH = 10, BOARD_HEIGHT = 20, CELL_SIZE = 25

const SHAPES = [
  { shape: [[1,1,1,1]], color: 'bg-cyan-500' },      // I
  { shape: [[1,1],[1,1]], color: 'bg-yellow-500' },  // O
  { shape: [[0,1,0],[1,1,1]], color: 'bg-purple-500' }, // T
  { shape: [[0,1,1],[1,1,0]], color: 'bg-green-500' },  // S
  { shape: [[1,1,0],[0,1,1]], color: 'bg-red-500' },    // Z
  { shape: [[1,0,0],[1,1,1]], color: 'bg-orange-500' }, // L
  { shape: [[0,0,1],[1,1,1]], color: 'bg-blue-500' }    // J
]

export default function GameTetris({ onClose }: GameTetrisProps) {
  const [board, setBoard] = useState<number[][]>(Array(BOARD_HEIGHT).fill(0).map(() => Array(BOARD_WIDTH).fill(0)))
  const [piece, setPiece] = useState<{ shape: number[][]; x: number; y: number; color: string; colorIdx: number } | null>(null)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const getRandomPiece = useCallback(() => {
    const idx = Math.floor(Math.random() * SHAPES.length)
    const { shape, color } = SHAPES[idx]
    return { shape: shape.map(row => [...row]), x: Math.floor((BOARD_WIDTH - shape[0].length) / 2), y: 0, color, colorIdx: idx }
  }, [])

  const checkCollision = useCallback((shape: number[][], x: number, y: number, board: number[][]) => {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[0].length; c++)
        if (shape[r][c]) {
          const newX = x + c, newY = y + r
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || newY < 0) return true
          if (newY >= 0 && board[newY][newX]) return true
        }
    return false
  }, [])

  const mergePiece = useCallback(() => {
    if (!piece) return
    const newBoard = board.map(row => [...row])
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[0].length; c++)
        if (piece.shape[r][c]) {
          const y = piece.y + r, x = piece.x + c
          if (y >= 0 && y < BOARD_HEIGHT) newBoard[y][x] = piece.colorIdx + 1
        }

    // 消除满行
    let rowsCleared = 0
    const finalBoard = newBoard.filter(row => {
      if (row.every(cell => cell !== 0)) { rowsCleared++; return false }
      return true
    })
    for (let i = 0; i < rowsCleared; i++) finalBoard.unshift(Array(BOARD_WIDTH).fill(0))

    const newScore = score + [0, 40, 100, 300, 1200][rowsCleared] * (level + 1)
    setScore(newScore)
    setLevel(Math.floor(newScore / 500))
    setBoard(finalBoard)

    const newPiece = getRandomPiece()
    if (checkCollision(newPiece.shape, newPiece.x, newPiece.y, finalBoard)) {
      setGameOver(true)
      setIsPlaying(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
    } else {
      setPiece(newPiece)
    }
  }, [piece, board, score, level, getRandomPiece, checkCollision])

  const move = useCallback((dx: number, dy: number) => {
    if (!piece || !isPlaying || gameOver || isPaused) return
    const newX = piece.x + dx, newY = piece.y + dy
    if (!checkCollision(piece.shape, newX, newY, board)) {
      setPiece({ ...piece, x: newX, y: newY })
    } else if (dy === 1) {
      mergePiece()
    }
  }, [piece, board, isPlaying, gameOver, isPaused, checkCollision, mergePiece])

  const rotate = useCallback(() => {
    if (!piece || !isPlaying || gameOver || isPaused) return
    const rotated = piece.shape[0].map((_, idx) => piece.shape.map(row => row[idx]).reverse())
    if (!checkCollision(rotated, piece.x, piece.y, board)) {
      setPiece({ ...piece, shape: rotated })
    }
  }, [piece, board, isPlaying, gameOver, isPaused, checkCollision])

  const hardDrop = useCallback(() => {
    if (!piece || !isPlaying || gameOver || isPaused) return
    while (!checkCollision(piece.shape, piece.x, piece.y + 1, board)) {
      setPiece(p => ({ ...p!, y: p!.y + 1 }))
    }
    mergePiece()
  }, [piece, board, isPlaying, gameOver, isPaused, checkCollision, mergePiece])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return
      if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); hardDrop() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); rotate() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1) }
      else if (e.key === 'p' || e.key === 'P') setIsPaused(p => !p)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isPlaying, gameOver, hardDrop, rotate, move])

  useEffect(() => {
    if (isPlaying && !gameOver && !isPaused) {
      const speed = Math.max(80, 500 - level * 30)
      intervalRef.current = setInterval(() => move(0, 1), speed)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, gameOver, isPaused, move, level])

  const startGame = () => {
    setBoard(Array(BOARD_HEIGHT).fill(0).map(() => Array(BOARD_WIDTH).fill(0)))
    setScore(0); setLevel(0); setGameOver(false); setIsPaused(false); setIsPlaying(true)
    setPiece(getRandomPiece())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-white">俄罗斯方块</h2><button onClick={onClose} className="text-gray-400 hover:text-white">✕</button></div>
        <div className="flex justify-between mb-4"><span className="text-white">得分: {score}</span><span className="text-white">等级: {level}</span>
          <div className="flex gap-2">
            {isPlaying && !gameOver && <button onClick={() => setIsPaused(p => !p)} className="px-3 py-1 bg-gray-700 rounded-lg text-white text-sm">{isPaused ? '继续' : '暂停'}</button>}
            {(!isPlaying || gameOver) && <button onClick={startGame} className="px-4 py-2 bg-green-600 rounded-lg text-white">{gameOver ? '重新开始' : '开始游戏'}</button>}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2 flex justify-center">
          <div className="relative" style={{ width: BOARD_WIDTH * CELL_SIZE, height: BOARD_HEIGHT * CELL_SIZE, backgroundColor: '#1f2937' }}>
            {board.map((row, y) => row.map((cell, x) => cell !== 0 && <div key={`${y}-${x}`} className={`absolute ${SHAPES[(cell-1) % SHAPES.length].color} border border-gray-700`} style={{ width: CELL_SIZE-1, height: CELL_SIZE-1, left: x*CELL_SIZE, top: y*CELL_SIZE }} />))}
            {piece?.shape.map((row, y) => row.map((cell, x) => cell && <div key={`piece-${y}-${x}`} className={`absolute ${piece.color} border border-gray-700`} style={{ width: CELL_SIZE-1, height: CELL_SIZE-1, left: (piece.x+x)*CELL_SIZE, top: (piece.y+y)*CELL_SIZE }} />))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-6 max-w-[280px] mx-auto">
          <button onClick={() => move(-1,0)} className="p-3 bg-gray-700 rounded-lg text-white text-xl">←</button>
          <button onClick={() => move(1,0)} className="p-3 bg-gray-700 rounded-lg text-white text-xl">→</button>
          <button onClick={() => move(0,1)} className="p-3 bg-gray-700 rounded-lg text-white text-xl">↓</button>
          <button onClick={rotate} className="p-3 bg-purple-600 rounded-lg text-white text-sm">旋转</button>
          <button onClick={hardDrop} className="col-span-4 p-2 bg-red-600 rounded-lg text-white text-sm">⬇️ 一键到底</button>
        </div>
        <p className="text-gray-500 text-xs text-center mt-4">键盘: ← → ↓ | ↑旋转 | 空格到底 | P暂停</p>
      </div>
    </div>
  )
}
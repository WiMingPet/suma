'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

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
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 触摸方向键状态
  const [touchDirection, setTouchDirection] = useState<string | null>(null)

  // 音效播放
  const playSound = (type: 'eat' | 'die' | 'start') => {
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
      } else if (type === 'die') {
        osc.frequency.value = 200
        gain.gain.value = 0.3
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
        osc.stop(ctx.currentTime + 0.5)
      } else {
        osc.frequency.value = 600
        gain.gain.value = 0.15
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
        osc.stop(ctx.currentTime + 0.3)
      }
      setTimeout(() => ctx.close(), 600)
    } catch (e) {}
  }

  // Three.js 3D背景
  useEffect(() => {
    if (!containerRef.current) return
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050b1a)
    scene.fog = new THREE.FogExp2(0x050b1a, 0.008)
    
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(0, 8, 18)
    camera.lookAt(0, 0, 0)
    
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)

    // 星空粒子系统
    const particlesCount = 1200
    const particlesGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(particlesCount * 3)
    for (let i = 0; i < particlesCount; i++) {
      positions[i*3] = (Math.random() - 0.5) * 80
      positions[i*3+1] = (Math.random() - 0.5) * 40
      positions[i*3+2] = (Math.random() - 0.5) * 50 - 20
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particlesMat = new THREE.PointsMaterial({ 
      color: 0x88aaff, 
      size: 0.12, 
      transparent: true, 
      opacity: 0.7,
      blending: THREE.AdditiveBlending 
    })
    const particles = new THREE.Points(particlesGeo, particlesMat)
    scene.add(particles)

    // 旋转光环
    const ringGeo = new THREE.TorusGeometry(3.5, 0.08, 64, 200)
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x2266aa, emissiveIntensity: 0.5 })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    scene.add(ring)

    const ring2Geo = new THREE.TorusGeometry(4.2, 0.05, 64, 200)
    const ring2Mat = new THREE.MeshStandardMaterial({ color: 0xff66cc, emissive: 0x882266, emissiveIntensity: 0.3 })
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat)
    ring2.rotation.x = Math.PI / 2 + 0.3
    scene.add(ring2)

    // 灯光
    const ambientLight = new THREE.AmbientLight(0x404060)
    scene.add(ambientLight)
    const pointLight = new THREE.PointLight(0xffffff, 0.8)
    pointLight.position.set(5, 10, 5)
    scene.add(pointLight)
    const backLight = new THREE.PointLight(0x4466ff, 0.5)
    backLight.position.set(-3, 5, -5)
    scene.add(backLight)

    let time = 0
    function animate() {
      requestAnimationFrame(animate)
      time += 0.01
      
      // 粒子旋转
      particles.rotation.y = time * 0.05
      particles.rotation.x = Math.sin(time * 0.1) * 0.1
      
      // 光环旋转
      ring.rotation.z = time * 0.3
      ring2.rotation.z = -time * 0.2
      
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  // 游戏逻辑
  useEffect(() => {
    if (!isPlaying || gameOver || isPaused) return
    
    gameLoopRef.current = setInterval(() => {
      setSnake(prev => {
        const head = prev[0]
        let newHead: [number, number]
        // 优先使用触摸方向，否则使用键盘方向
        const currentDir = touchDirection || direction
        switch (currentDir) {
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
    }, Math.max(80, 150 - (level - 1) * 8))
    
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current) }
  }, [isPlaying, gameOver, isPaused, direction, touchDirection, food, score, level])

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
          // 清除触摸方向，让键盘方向生效
          setTouchDirection(null)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPlaying, gameOver, isPaused, direction])

  // 触摸方向键处理
  const handleTouchDirection = (dir: string) => {
    if (!isPlaying || gameOver || isPaused) return
    const opposite = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
    // 不能反向
    if (opposite[dir as keyof typeof opposite] !== direction && opposite[dir as keyof typeof opposite] !== touchDirection) {
      setTouchDirection(dir)
    }
  }

  const startGame = () => {
    setSnake(INIT_SNAKE)
    setDirection(INIT_DIR)
    setTouchDirection(null)
    setFood([15, 10])
    setScore(0)
    setLevel(1)
    setGameOver(false)
    setIsPlaying(true)
    setIsPaused(false)
    playSound('start')
  }

  const togglePause = () => {
    if (!isPlaying || gameOver) return
    setIsPaused(p => !p)
  }

  // 食物特效（闪烁）
  const foodGlow = `0 0 ${8 + Math.sin(Date.now() * 0.01) * 2}px #ffaa44`

  return (
    <div className="fixed inset-0 z-50">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative bg-black/60 backdrop-blur-md rounded-2xl p-6 max-w-md w-full mx-4 pointer-events-auto border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">🐍 贪吃蛇美食大战</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
          </div>
          <div className="flex justify-between text-white mb-2">
            <span>🍎 得分: <span className="text-yellow-400 font-bold">{score}</span></span>
            <span>⭐ 等级: <span className="text-green-400 font-bold">{level}</span></span>
          </div>
          <div className="bg-gray-900/80 rounded-xl p-3 flex justify-center">
            <div 
              className="gap-0.5 bg-gray-800/50 p-1 rounded"
              style={{ 
                width: GRID_SIZE * (CELL_SIZE + 2), 
                height: GRID_SIZE * (CELL_SIZE + 2),
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`
              }}
            >
              {Array.from({ length: GRID_SIZE }).map((_, y) => (
                Array.from({ length: GRID_SIZE }).map((_, x) => {
                  const isSnake = snake.some(seg => seg[0] === x && seg[1] === y)
                  const isFood = food[0] === x && food[1] === y
                  const isHead = isSnake && snake[0][0] === x && snake[0][1] === y
                  return (
                    <div
                      key={`${x}-${y}`}
                      className="w-5 h-5 rounded-sm transition-all duration-100"
                      style={{
                        backgroundColor: isSnake ? (isHead ? '#60f0a0' : '#3ac87a') : isFood ? '#facc15' : '#2a2a3a',
                        boxShadow: isSnake ? '0 0 6px #4ade80' : isFood ? foodGlow : 'none',
                        border: isSnake ? '1px solid #88ffaa' : 'none',
                      }}
                    />
                  )
                })
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            {!isPlaying && !gameOver && (
              <button onClick={startGame} className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-bold hover:scale-105 transition">▶ 开始游戏</button>
            )}
            {isPlaying && !gameOver && (
              <button onClick={togglePause} className="flex-1 py-2 bg-yellow-600 rounded-xl text-white font-bold hover:scale-105 transition">{isPaused ? '▶ 继续' : '⏸ 暂停'}</button>
            )}
            {gameOver && (
              <button onClick={startGame} className="flex-1 py-2 bg-red-600 rounded-xl text-white font-bold hover:scale-105 transition">🔄 重新开始</button>
            )}
          </div>
          <p className="text-gray-400 text-xs text-center mt-4">键盘方向键控制 | 每100分升1级 | 速度递增</p>
          
          {/* 手机触摸方向键 */}
          {isPlaying && !gameOver && (
            <div className="absolute -bottom-24 left-0 right-0 flex justify-center gap-4 mt-4 pb-4">
              <div className="flex flex-col items-center gap-2">
                {/* 上键 */}
                <button
                  onTouchStart={() => handleTouchDirection('UP')}
                  onTouchEnd={() => setTouchDirection(null)}
                  onMouseDown={() => handleTouchDirection('UP')}
                  onMouseUp={() => setTouchDirection(null)}
                  onMouseLeave={() => setTouchDirection(null)}
                  className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white text-2xl active:scale-95 transition"
                >
                  ▲
                </button>
                <div className="flex gap-4">
                  {/* 左键 */}
                  <button
                    onTouchStart={() => handleTouchDirection('LEFT')}
                    onTouchEnd={() => setTouchDirection(null)}
                    onMouseDown={() => handleTouchDirection('LEFT')}
                    onMouseUp={() => setTouchDirection(null)}
                    onMouseLeave={() => setTouchDirection(null)}
                    className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white text-2xl active:scale-95 transition"
                  >
                    ◀
                  </button>
                  {/* 下键 */}
                  <button
                    onTouchStart={() => handleTouchDirection('DOWN')}
                    onTouchEnd={() => setTouchDirection(null)}
                    onMouseDown={() => handleTouchDirection('DOWN')}
                    onMouseUp={() => setTouchDirection(null)}
                    onMouseLeave={() => setTouchDirection(null)}
                    className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white text-2xl active:scale-95 transition"
                  >
                    ▼
                  </button>
                  {/* 右键 */}
                  <button
                    onTouchStart={() => handleTouchDirection('RIGHT')}
                    onTouchEnd={() => setTouchDirection(null)}
                    onMouseDown={() => handleTouchDirection('RIGHT')}
                    onMouseUp={() => setTouchDirection(null)}
                    onMouseLeave={() => setTouchDirection(null)}
                    className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white text-2xl active:scale-95 transition"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
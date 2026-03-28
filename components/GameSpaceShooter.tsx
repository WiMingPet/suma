'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface GameSpaceShooterProps {
  onClose: () => void
}

interface Enemy {
  mesh: THREE.Mesh
  speed: number
  health: number
}

interface Bullet {
  mesh: THREE.Mesh
  speed: number
}

export default function GameSpaceShooter({ onClose }: GameSpaceShooterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const playerRef = useRef<THREE.Mesh | null>(null)
  const enemiesRef = useRef<Enemy[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const starsRef = useRef<THREE.Points | null>(null)
  
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(3)
  const [gameOver, setGameOver] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  
  const keysRef = useRef({ left: false, right: false, up: false, down: false })
  const shootCooldownRef = useRef(0)
  const animationRef = useRef<number>()

  // 音效播放
  const playSound = (type: 'shoot' | 'explosion' | 'hit') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      if (type === 'shoot') {
        osc.frequency.value = 1200
        gain.gain.value = 0.15
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1)
        osc.stop(ctx.currentTime + 0.1)
      } else if (type === 'explosion') {
        osc.frequency.value = 200
        gain.gain.value = 0.3
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
        osc.stop(ctx.currentTime + 0.3)
      } else {
        osc.frequency.value = 400
        gain.gain.value = 0.2
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2)
        osc.stop(ctx.currentTime + 0.2)
      }
      setTimeout(() => ctx.close(), 500)
    } catch (e) {}
  }

  // 创建粒子爆炸效果
  const createExplosion = (position: THREE.Vector3) => {
    if (!sceneRef.current) return
    
    const particleCount = 20
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 4, 4)
      const material = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300 })
      const particle = new THREE.Mesh(geometry, material)
      particle.position.copy(position)
      sceneRef.current.add(particle)
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      )
      
      let life = 0
      const animateParticle = () => {
        particle.position.x += velocity.x
        particle.position.y += velocity.y
        particle.position.z += velocity.z
        life++
        if (life < 30) {
          requestAnimationFrame(animateParticle)
        } else {
          sceneRef.current?.remove(particle)
        }
      }
      requestAnimationFrame(animateParticle)
    }
  }

  // 初始化3D场景
  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000011)
    scene.fog = new THREE.FogExp2(0x000011, 0.003)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 2, 12)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 星空背景粒子
    const starCount = 2000
    const starGeometry = new THREE.BufferGeometry()
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPositions[i*3] = (Math.random() - 0.5) * 200
      starPositions[i*3+1] = (Math.random() - 0.5) * 100
      starPositions[i*3+2] = (Math.random() - 0.5) * 50 - 30
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.6 })
    const stars = new THREE.Points(starGeometry, starMaterial)
    scene.add(stars)
    starsRef.current = stars

    // 玩家飞船
    const shipGroup = new THREE.Group()
    
    const bodyGeometry = new THREE.ConeGeometry(0.6, 1.2, 8)
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x33aaff, emissive: 0x1166aa, metalness: 0.8 })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.rotation.x = Math.PI / 2
    shipGroup.add(body)
    
    const wingGeometry = new THREE.BoxGeometry(1.2, 0.1, 0.4)
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x44ccff })
    const wings = new THREE.Mesh(wingGeometry, wingMaterial)
    wings.position.z = -0.3
    shipGroup.add(wings)
    
    const engineGeometry = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 6)
    const engineMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300 })
    const engine = new THREE.Mesh(engineGeometry, engineMaterial)
    engine.position.z = -0.6
    shipGroup.add(engine)
    
    const player = shipGroup as unknown as THREE.Mesh
    player.position.set(0, -1, 0)
    scene.add(player)
    playerRef.current = player

    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0x333344)
    scene.add(ambientLight)
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(5, 10, 7)
    dirLight.castShadow = true
    scene.add(dirLight)
    
    const backLight = new THREE.PointLight(0x3366ff, 0.5)
    backLight.position.set(0, 0, -5)
    scene.add(backLight)

    // 粒子光环环绕
    const ringParticles: THREE.Mesh[] = []
    for (let i = 0; i < 60; i++) {
      const particleGeo = new THREE.SphereGeometry(0.05, 6, 6)
      const particleMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x2266aa })
      const particle = new THREE.Mesh(particleGeo, particleMat)
      const angle = (i / 60) * Math.PI * 2
      particle.position.set(Math.cos(angle) * 2.5, Math.sin(angle) * 1.5, -2)
      scene.add(particle)
      ringParticles.push(particle)
    }

    let time = 0
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      time += 0.02
      
      // 旋转光环
      ringParticles.forEach((p, i) => {
        const angle = (i / 60) * Math.PI * 2 + time * 2
        p.position.x = Math.cos(angle) * 2.5
        p.position.y = Math.sin(angle) * 1.5
      })
      
      // 星星旋转
      stars.rotation.y = time * 0.02
      stars.rotation.x = Math.sin(time * 0.1) * 0.1
      
      // 玩家移动
      if (playerRef.current && isPlaying && !gameOver) {
        const speed = 0.15
        if (keysRef.current.left && playerRef.current.position.x > -4) playerRef.current.position.x -= speed
        if (keysRef.current.right && playerRef.current.position.x < 4) playerRef.current.position.x += speed
        if (keysRef.current.up && playerRef.current.position.y < 3) playerRef.current.position.y += speed
        if (keysRef.current.down && playerRef.current.position.y > -3) playerRef.current.position.y -= speed
      }
      
      // 更新子弹
      bulletsRef.current.forEach((bullet, i) => {
        bullet.mesh.position.z += bullet.speed
        if (bullet.mesh.position.z > 15) {
          scene.remove(bullet.mesh)
          bulletsRef.current.splice(i, 1)
        }
      })
      
      // 更新敌人
      enemiesRef.current.forEach((enemy, i) => {
        enemy.mesh.position.z += enemy.speed
        
        // 边界移除
        if (enemy.mesh.position.z < -8 || enemy.mesh.position.z > 12) {
          scene.remove(enemy.mesh)
          enemiesRef.current.splice(i, 1)
          return
        }
        
        // 碰撞检测
        if (playerRef.current && !gameOver) {
          const dist = playerRef.current.position.distanceTo(enemy.mesh.position)
          if (dist < 1) {
            scene.remove(enemy.mesh)
            enemiesRef.current.splice(i, 1)
            setHealth(h => {
              const newHealth = h - 1
              if (newHealth <= 0) {
                setGameOver(true)
                setIsPlaying(false)
                playSound('explosion')
              }
              return newHealth
            })
            playSound('hit')
            createExplosion(enemy.mesh.position)
          }
        }
        
        // 子弹碰撞
        bulletsRef.current.forEach((bullet, j) => {
          if (bullet.mesh.position.distanceTo(enemy.mesh.position) < 0.8) {
            scene.remove(bullet.mesh)
            bulletsRef.current.splice(j, 1)
            scene.remove(enemy.mesh)
            enemiesRef.current.splice(i, 1)
            setScore(s => s + 10)
            playSound('explosion')
            createExplosion(enemy.mesh.position)
          }
        })
      })
      
      // 生成敌人
      if (isPlaying && !gameOver && Math.random() < 0.02) {
        const enemyGeo = new THREE.IcosahedronGeometry(0.4, 0)
        const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff4466, emissive: 0xaa2244 })
        const enemy = new THREE.Mesh(enemyGeo, enemyMat)
        enemy.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, 12)
        scene.add(enemy)
        enemiesRef.current.push({
          mesh: enemy,
          speed: -0.08 - Math.random() * 0.05,
          health: 1
        })
      }
      
      // 射击冷却
      if (shootCooldownRef.current > 0) shootCooldownRef.current--
      
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }
    
    animate()
    
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(window.innerWidth, window.innerHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
      rendererRef.current?.dispose()
    }
  }, [isPlaying, gameOver])

  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return
      
      switch(e.key) {
        case 'ArrowLeft': keysRef.current.left = true; break
        case 'ArrowRight': keysRef.current.right = true; break
        case 'ArrowUp': keysRef.current.up = true; break
        case 'ArrowDown': keysRef.current.down = true; break
        case 'a': keysRef.current.left = true; break
        case 'd': keysRef.current.right = true; break
        case 'w': keysRef.current.up = true; break
        case 's': keysRef.current.down = true; break
        case ' ': case 'Space':
          e.preventDefault()
          if (shootCooldownRef.current === 0 && sceneRef.current && playerRef.current) {
            const bulletGeo = new THREE.SphereGeometry(0.1, 6, 6)
            const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff4400 })
            const bullet = new THREE.Mesh(bulletGeo, bulletMat)
            bullet.position.copy(playerRef.current.position)
            bullet.position.z += 0.5
            sceneRef.current.add(bullet)
            bulletsRef.current.push({ mesh: bullet, speed: 0.25 })
            shootCooldownRef.current = 15
            playSound('shoot')
          }
          break
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowLeft': case 'a': keysRef.current.left = false; break
        case 'ArrowRight': case 'd': keysRef.current.right = false; break
        case 'ArrowUp': case 'w': keysRef.current.up = false; break
        case 'ArrowDown': case 's': keysRef.current.down = false; break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isPlaying, gameOver])

  const startGame = () => {
    // 清空所有敌人和子弹
    enemiesRef.current.forEach(enemy => sceneRef.current?.remove(enemy.mesh))
    bulletsRef.current.forEach(bullet => sceneRef.current?.remove(bullet.mesh))
    enemiesRef.current = []
    bulletsRef.current = []
    
    setScore(0)
    setHealth(3)
    setGameOver(false)
    setIsPlaying(true)
    
    if (playerRef.current) {
      playerRef.current.position.set(0, -1, 0)
    }
    
    playSound('shoot')
  }

  return (
    <div className="fixed inset-0 z-50">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* UI 控制面板 - 悬浮在右上角 */}
      <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-md rounded-xl p-4 pointer-events-auto border border-white/20 shadow-2xl min-w-[200px]">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-xl font-bold text-white">🚀 3D太空射击</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">✕</button>
        </div>
        
        <div className="flex justify-between text-white mb-3">
          <span>🎯 得分:</span>
          <span className="text-yellow-400 font-bold">{score}</span>
        </div>
        
        <div className="flex justify-between text-white mb-4">
          <span>❤️ 生命:</span>
          <span className="text-red-400 font-bold">{'❤️'.repeat(health)}</span>
        </div>
        
        {!isPlaying && !gameOver && (
          <button 
            onClick={startGame}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-bold hover:scale-105 transition"
          >
            🚀 开始游戏
          </button>
        )}
        
        {isPlaying && !gameOver && (
          <div className="text-center text-white text-xs bg-white/10 rounded-lg py-2">
            🎮 方向键/WASD移动 | 空格射击
          </div>
        )}
        
        {gameOver && (
          <div className="text-center">
            <p className="text-red-400 text-lg mb-2">💀 游戏结束</p>
            <p className="text-white mb-3">最终得分: {score}</p>
            <button 
              onClick={startGame}
              className="w-full py-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white font-bold hover:scale-105 transition"
            >
              🔄 重新开始
            </button>
          </div>
        )}
        
        <p className="text-gray-400 text-xs text-center mt-3">WSAD/方向键 | 空格射击 | 3D星空特效</p>
      </div>
    </div>
  )
}
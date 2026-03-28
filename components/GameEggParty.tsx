'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface GameEggPartyProps {
  onClose: () => void
}

interface Player {
  id: string
  mesh: THREE.Group
  type: 'player' | 'ai'
  skin: string
  health: number
  score: number
  velocity: { x: number; z: number }
  lastAttack: number
  isStunned: boolean
  stunEndTime: number
  name: string
  hitFlash: number
}

interface PowerUp {
  mesh: THREE.Mesh
  type: 'bomb' | 'freeze' | 'speed' | 'heal'
  collected: boolean
}

interface Shockwave {
  mesh: THREE.Mesh
  life: number
  maxLife: number
  scale: number
}

// 蛋仔皮肤配置
const EGG_SKINS = [
  { id: 'yellow', name: '小黄蛋', color: 0xffcc88, accent: 0xffaa66, hat: 0xff8888, icon: '🥚' },
  { id: 'pink', name: '粉粉蛋', color: 0xffaacc, accent: 0xff88aa, hat: 0xffaacc, icon: '🌸' },
  { id: 'blue', name: '蓝蓝蛋', color: 0x88aaff, accent: 0x6688dd, hat: 0x88aaff, icon: '💙' },
  { id: 'green', name: '绿绿蛋', color: 0x88dd88, accent: 0x66aa66, hat: 0x88dd88, icon: '💚' },
  { id: 'purple', name: '紫紫蛋', color: 0xcc88ff, accent: 0xaa66dd, hat: 0xcc88ff, icon: '💜' },
  { id: 'orange', name: '橙橙蛋', color: 0xffaa66, accent: 0xdd8844, hat: 0xffaa66, icon: '🧡' },
]

// AI 名字
const AI_NAMES = ['蛋小黄', '蛋小粉', '蛋小蓝', '蛋小绿', '蛋小紫', '蛋小橙', '捣蛋鬼', '暴走蛋', '萌蛋蛋', '铁蛋蛋']

export default function GameEggParty({ onClose }: GameEggPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const playersRef = useRef<Player[]>([])
  const powerUpsRef = useRef<PowerUp[]>([])
  const shockwavesRef = useRef<Shockwave[]>([])
  const floatingOrbsRef = useRef<THREE.Mesh[]>([])
  
  const [gameMode, setGameMode] = useState<'select' | 'battle'>('select')
  const [selectedSkin, setSelectedSkin] = useState(0)
  const [playerName, setPlayerName] = useState('蛋仔玩家')
  const [aiCount, setAiCount] = useState(3)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'gameover'>('waiting')
  const [winner, setWinner] = useState<string | null>(null)
  const [playerHealth, setPlayerHealth] = useState(100)
  const [playerScore, setPlayerScore] = useState(0)
  const [survivalTime, setSurvivalTime] = useState(0)
  const [screenShake, setScreenShake] = useState(0)
  const [combo, setCombo] = useState(0)
  const [comboTimer, setComboTimer] = useState(0)
  
  const keysRef = useRef({ left: false, right: false, up: false, down: false, attack: false })
  const animationRef = useRef<number>()
  const timeRef = useRef<number>(0)
  const attackCooldownRef = useRef(0)
  const cameraShakeRef = useRef({ x: 0, z: 0, intensity: 0 })

  // 增强音效
  const playSound = (type: 'attack' | 'hit' | 'collect' | 'gameover' | 'start' | 'combo' | 'victory') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      if (type === 'attack') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 500
        gain.gain.value = 0.25
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15)
        osc.stop(ctx.currentTime + 0.15)
        setTimeout(() => ctx.close(), 200)
      } else if (type === 'hit') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const noise = ctx.createBufferSource()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 180
        gain.gain.value = 0.3
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
        osc.stop(ctx.currentTime + 0.25)
        setTimeout(() => ctx.close(), 300)
      } else if (type === 'collect') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 900
        gain.gain.value = 0.2
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
        osc.stop(ctx.currentTime + 0.12)
        setTimeout(() => ctx.close(), 150)
      } else if (type === 'combo') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 1200
        gain.gain.value = 0.35
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2)
        osc.stop(ctx.currentTime + 0.2)
        setTimeout(() => ctx.close(), 250)
      } else if (type === 'victory') {
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)
        osc1.frequency.value = 800
        osc2.frequency.value = 1200
        gain.gain.value = 0.4
        osc1.start()
        osc2.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8)
        osc1.stop(ctx.currentTime + 0.8)
        osc2.stop(ctx.currentTime + 0.8)
        setTimeout(() => ctx.close(), 900)
      } else {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 600
        gain.gain.value = 0.2
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
        osc.stop(ctx.currentTime + 0.3)
        setTimeout(() => ctx.close(), 400)
      }
    } catch (e) {}
  }

  // 屏幕震动
  const shakeScreen = (intensity: number, duration: number) => {
    setScreenShake(intensity)
    cameraShakeRef.current = { x: 0, z: 0, intensity: intensity }
    setTimeout(() => {
      if (cameraShakeRef.current.intensity === intensity) {
        setScreenShake(0)
        cameraShakeRef.current.intensity = 0
      }
    }, duration)
  }

  // 增强粒子特效
  const createParticles = (position: THREE.Vector3, color: number, count: number = 20, size: number = 0.08, spread: number = 0.6) => {
    if (!sceneRef.current) return
    
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(size, 6, 6)
      const material = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 })
      const particle = new THREE.Mesh(geometry, material)
      particle.position.copy(position)
      sceneRef.current.add(particle)
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * spread,
        (Math.random() - 0.5) * spread
      )
      
      let life = 0
      const animateParticle = () => {
        particle.position.x += velocity.x
        particle.position.y += velocity.y
        particle.position.z += velocity.z
        particle.scale.multiplyScalar(0.95)
        life++
        if (life < 40) {
          requestAnimationFrame(animateParticle)
        } else {
          sceneRef.current?.remove(particle)
        }
      }
      requestAnimationFrame(animateParticle)
    }
  }

  // 创建冲击波
  const createShockwave = (position: THREE.Vector3, color: number) => {
    if (!sceneRef.current) return
    
    const ringGeo = new THREE.TorusGeometry(0.5, 0.08, 32, 64)
    const ringMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, transparent: true, opacity: 0.8 })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.copy(position)
    ring.position.y = 0.1
    sceneRef.current.add(ring)
    
    shockwavesRef.current.push({
      mesh: ring,
      life: 0,
      maxLife: 30,
      scale: 1
    })
  }

  // 创建胜利光环
  const createVictoryAura = (position: THREE.Vector3) => {
    if (!sceneRef.current) return
    
    const particles: THREE.Mesh[] = []
    for (let i = 0; i < 60; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 6, 6)
      const material = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff6600, emissiveIntensity: 0.8 })
      const particle = new THREE.Mesh(geometry, material)
      const angle = (i / 60) * Math.PI * 2
      const radius = 1.5
      particle.position.set(position.x + Math.cos(angle) * radius, position.y + 0.5, position.z + Math.sin(angle) * radius)
      sceneRef.current.add(particle)
      particles.push(particle)
    }
    
    let angle = 0
    const animateAura = () => {
      angle += 0.05
      particles.forEach((p, i) => {
        const rad = (i / particles.length) * Math.PI * 2 + angle
        const radius = 1.5 + Math.sin(angle * 2) * 0.2
        p.position.x = position.x + Math.cos(rad) * radius
        p.position.z = position.z + Math.sin(rad) * radius
        p.position.y = position.y + 0.5 + Math.sin(angle * 3) * 0.2
        p.scale.setScalar(0.8 + Math.sin(angle * 5 + i) * 0.3)
      })
      if (angle < Math.PI * 4) {
        requestAnimationFrame(animateAura)
      } else {
        particles.forEach(p => sceneRef.current?.remove(p))
      }
    }
    animateAura()
  }

  // 创建蛋仔角色（增强版）
  const createEggCharacter = (skinColor: number, accentColor: number, hatColor: number) => {
    const group = new THREE.Group()
    
    // 身体
    const bodyGeo = new THREE.SphereGeometry(0.55, 48, 48)
    const bodyMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.2, metalness: 0.1 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.scale.set(1, 1.15, 0.9)
    body.castShadow = true
    group.add(body)
    
    // 大眼睛（带高光）
    const eyeWhiteGeo = new THREE.SphereGeometry(0.18, 48, 48)
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
    const leftEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat)
    leftEye.position.set(-0.3, 0.35, 0.68)
    group.add(leftEye)
    const rightEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat)
    rightEye.position.set(0.3, 0.35, 0.68)
    group.add(rightEye)
    
    // 瞳孔（会随移动方向转动）
    const eyeBlackGeo = new THREE.SphereGeometry(0.12, 32, 32)
    const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x000000 })
    const leftPupil = new THREE.Mesh(eyeBlackGeo, eyeBlackMat)
    leftPupil.position.set(-0.3, 0.33, 0.85)
    group.add(leftPupil)
    const rightPupil = new THREE.Mesh(eyeBlackGeo, eyeBlackMat)
    rightPupil.position.set(0.3, 0.33, 0.85)
    group.add(rightPupil)
    
    // 高光
    const highlightGeo = new THREE.SphereGeometry(0.06, 24, 24)
    const highlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
    const leftHighlight = new THREE.Mesh(highlightGeo, highlightMat)
    leftHighlight.position.set(-0.34, 0.42, 0.9)
    group.add(leftHighlight)
    const rightHighlight = new THREE.Mesh(highlightGeo, highlightMat)
    rightHighlight.position.set(0.26, 0.42, 0.9)
    group.add(rightHighlight)
    
    // 腮红
    const blushGeo = new THREE.SphereGeometry(0.09, 24, 24)
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa, emissive: 0xff8888, emissiveIntensity: 0.2 })
    const leftBlush = new THREE.Mesh(blushGeo, blushMat)
    leftBlush.position.set(-0.48, 0.12, 0.72)
    group.add(leftBlush)
    const rightBlush = new THREE.Mesh(blushGeo, blushMat)
    rightBlush.position.set(0.48, 0.12, 0.72)
    group.add(rightBlush)
    
    // 嘴巴
    const mouthGeo = new THREE.TorusGeometry(0.13, 0.05, 24, 48, Math.PI)
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xcc8866 })
    const mouth = new THREE.Mesh(mouthGeo, mouthMat)
    mouth.rotation.x = 0.15
    mouth.rotation.z = 0.1
    mouth.position.set(0, 0.02, 0.78)
    group.add(mouth)
    
    // 帽子
    const hatGeo = new THREE.ConeGeometry(0.48, 0.38, 12)
    const hatMat = new THREE.MeshStandardMaterial({ color: hatColor, metalness: 0.3 })
    const hat = new THREE.Mesh(hatGeo, hatMat)
    hat.position.y = 0.73
    group.add(hat)
    
    const hatBallGeo = new THREE.SphereGeometry(0.12, 16, 16)
    const hatBallMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.3 })
    const hatBall = new THREE.Mesh(hatBallGeo, hatBallMat)
    hatBall.position.set(0, 0.92, 0)
    group.add(hatBall)
    
    group.castShadow = true
    group.receiveShadow = true
    return group
  }

  // 初始化战斗场景（增强版）
  const initBattleScene = () => {
    if (!sceneRef.current) return
    
    const scene = sceneRef.current
    
    // 竞技场地面（带网格纹理）
    const arenaSize = 16
    const gridHelper = new THREE.GridHelper(arenaSize, 20, 0x88aaff, 0x4466aa)
    gridHelper.position.y = -0.85
    gridHelper.material.transparent = true
    gridHelper.material.opacity = 0.5
    scene.add(gridHelper)
    
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x5c9e5e, roughness: 0.7, metalness: 0.1 })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(arenaSize, arenaSize), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.9
    ground.receiveShadow = true
    scene.add(ground)
    
    // 装饰性光柱（四个角落）
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xddaa77, emissive: 0x442200 })
    const corners = [[-7, -7], [-7, 7], [7, -7], [7, 7]]
    corners.forEach(([x, z]) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.8, 8), pillarMat)
      pillar.position.set(x, -0.2, z)
      pillar.castShadow = true
      scene.add(pillar)
      
      const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffaa66, emissive: 0xff4400, emissiveIntensity: 0.5 }))
      topLight.position.set(x, 0.7, z)
      scene.add(topLight)
      floatingOrbsRef.current.push(topLight)
    })
    
    // 漂浮粒子（氛围）
    const ambientParticles = new THREE.BufferGeometry()
    const particleCount = 400
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      positions[i*3] = (Math.random() - 0.5) * 18
      positions[i*3+1] = Math.random() * 3
      positions[i*3+2] = (Math.random() - 0.5) * 18
    }
    ambientParticles.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({ color: 0x88aaff, size: 0.05, transparent: true, opacity: 0.4 })
    const particles = new THREE.Points(ambientParticles, particleMat)
    scene.add(particles)
    
    // 动态灯光
    const ambientLight = new THREE.AmbientLight(0x88aaff, 0.6)
    scene.add(ambientLight)
    
    const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.2)
    mainLight.position.set(5, 8, 4)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 1024
    mainLight.shadow.mapSize.height = 1024
    scene.add(mainLight)
    
    const fillLight = new THREE.PointLight(0xffaa66, 0.5)
    fillLight.position.set(0, 3, 0)
    scene.add(fillLight)
    
    const backLight = new THREE.PointLight(0x6688ff, 0.4)
    backLight.position.set(0, 2, -5)
    scene.add(backLight)
    
    const colorLight = new THREE.PointLight(0xff66aa, 0.3)
    colorLight.position.set(3, 2, 3)
    scene.add(colorLight)
    
    return { particles, mainLight, fillLight, colorLight }
  }

  // 开始游戏
  const startBattle = () => {
    if (!sceneRef.current || !cameraRef.current) return
    
    setGameStatus('playing')
    setWinner(null)
    setPlayerHealth(100)
    setPlayerScore(0)
    setSurvivalTime(0)
    setCombo(0)
    setComboTimer(0)
    timeRef.current = 0
    
    // 清除现有玩家和道具
    playersRef.current.forEach(p => sceneRef.current?.remove(p.mesh))
    powerUpsRef.current.forEach(p => sceneRef.current?.remove(p.mesh))
    shockwavesRef.current.forEach(s => sceneRef.current?.remove(s.mesh))
    playersRef.current = []
    powerUpsRef.current = []
    shockwavesRef.current = []
    
    const skin = EGG_SKINS[selectedSkin]
    
    // 创建玩家
    const playerMesh = createEggCharacter(skin.color, skin.accent, skin.hat)
    playerMesh.position.set(0, 0, 0)
    sceneRef.current.add(playerMesh)
    
    playersRef.current.push({
      id: 'player',
      mesh: playerMesh,
      type: 'player',
      skin: skin.id,
      health: 100,
      score: 0,
      velocity: { x: 0, z: 0 },
      lastAttack: 0,
      isStunned: false,
      stunEndTime: 0,
      name: playerName,
      hitFlash: 0
    })
    
    // 创建 AI 对手
    const positions = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5], [-5, 0], [5, 0], [0, -5], [0, 5]]
    for (let i = 0; i < Math.min(aiCount, 8); i++) {
      const aiSkin = EGG_SKINS[Math.floor(Math.random() * EGG_SKINS.length)]
      const aiMesh = createEggCharacter(aiSkin.color, aiSkin.accent, aiSkin.hat)
      const pos = positions[i % positions.length]
      aiMesh.position.set(pos[0], 0, pos[1])
      sceneRef.current.add(aiMesh)
      
      playersRef.current.push({
        id: `ai_${i}`,
        mesh: aiMesh,
        type: 'ai',
        skin: aiSkin.id,
        health: 100,
        score: 0,
        velocity: { x: 0, z: 0 },
        lastAttack: 0,
        isStunned: false,
        stunEndTime: 0,
        name: AI_NAMES[i % AI_NAMES.length],
        hitFlash: 0
      })
    }
    
    // 创建道具
    const powerUpTypes: ('bomb' | 'freeze' | 'speed' | 'heal')[] = ['bomb', 'freeze', 'speed', 'heal']
    for (let i = 0; i < 15; i++) {
      const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]
      let color, shape
      
      if (type === 'bomb') {
        color = 0xff4444
        shape = new THREE.SphereGeometry(0.24, 16, 16)
      } else if (type === 'freeze') {
        color = 0x44aaff
        shape = new THREE.IcosahedronGeometry(0.24, 0)
      } else if (type === 'speed') {
        color = 0x44ff44
        shape = new THREE.CylinderGeometry(0.22, 0.27, 0.45, 8)
      } else {
        color = 0xffaa44
        shape = new THREE.ConeGeometry(0.27, 0.45, 8)
      }
      
      const powerMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 })
      const powerUp = new THREE.Mesh(shape, powerMat)
      powerUp.position.set(
        (Math.random() - 0.5) * 12,
        0.25,
        (Math.random() - 0.5) * 12
      )
      powerUp.castShadow = true
      sceneRef.current.add(powerUp)
      
      powerUpsRef.current.push({
        mesh: powerUp,
        type: type,
        collected: false
      })
    }
    
    playSound('start')
  }

  // AI 决策
  const aiMove = (ai: Player, delta: number, players: Player[]) => {
    const player = players.find(p => p.id === 'player')
    if (!player || ai.isStunned) return false
    
    const dx = player.mesh.position.x - ai.mesh.position.x
    const dz = player.mesh.position.z - ai.mesh.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    
    // 移动向玩家
    if (dist > 1.5) {
      const moveX = dx / dist * 4
      const moveZ = dz / dist * 4
      ai.velocity.x += moveX * delta
      ai.velocity.z += moveZ * delta
    } else if (dist < 1.2) {
      // 远离玩家（避免重叠）
      ai.velocity.x -= dx * 2 * delta
      ai.velocity.z -= dz * 2 * delta
    }
    
    // 攻击
    if (dist < 1.6 && Date.now() - ai.lastAttack > 1300) {
      ai.lastAttack = Date.now()
      return true
    }
    
    return false
  }

  // 更新游戏逻辑
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || gameStatus !== 'playing') return
    
    let lastTime = performance.now()
    let comboDecayTimer = 0
    
    const updateGame = () => {
      animationRef.current = requestAnimationFrame(updateGame)
      const now = performance.now()
      const delta = Math.min(0.033, (now - lastTime) / 1000)
      lastTime = now
      
      // 更新时间
      timeRef.current += delta
      setSurvivalTime(Math.floor(timeRef.current))
      
      // Combo 衰减
      if (comboTimer > 0) {
        comboDecayTimer += delta
        if (comboDecayTimer > 1) {
          comboDecayTimer = 0
          setCombo(c => Math.max(0, c - 1))
        }
      }
      
      const player = playersRef.current.find(p => p.id === 'player')
      if (!player) return
      
      // 更新晕眩状态
      if (player.isStunned && Date.now() > player.stunEndTime) {
        player.isStunned = false
      }
      
      // 更新击中闪烁
      if (player.hitFlash > 0) {
        player.hitFlash -= delta * 10
        const intensity = Math.min(1, player.hitFlash / 10)
        player.mesh.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material) {
            const origColor = child.userData.origColor
            if (origColor && child.material.color) {
              child.material.color.setHex(0xff8888)
            }
          }
        })
        if (player.hitFlash <= 0) {
          player.mesh.children.forEach(child => {
            if (child instanceof THREE.Mesh && child.userData.origColor && child.material.color) {
              child.material.color.setHex(child.userData.origColor)
            }
          })
        }
      }
      
      // 玩家移动
      if (!player.isStunned) {
        let moveX = 0, moveZ = 0
        if (keysRef.current.left) moveX = -1
        if (keysRef.current.right) moveX = 1
        if (keysRef.current.up) moveZ = -1
        if (keysRef.current.down) moveZ = 1
        
        if (moveX !== 0 || moveZ !== 0) {
          const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
          moveX /= len
          moveZ /= len
          player.velocity.x += moveX * 6 * delta
          player.velocity.z += moveZ * 6 * delta
        }
        
        // 攻击
        if (keysRef.current.attack && Date.now() - player.lastAttack > 700 && attackCooldownRef.current === 0) {
          player.lastAttack = Date.now()
          attackCooldownRef.current = 25
          playSound('attack')
          createShockwave(player.mesh.position, 0xffaa44)
          shakeScreen(0.15, 100)
          
          let hitCount = 0
          playersRef.current.forEach(target => {
            if (target.id !== 'player') {
              const dx = target.mesh.position.x - player.mesh.position.x
              const dz = target.mesh.position.z - player.mesh.position.z
              const dist = Math.sqrt(dx * dx + dz * dz)
              if (dist < 1.6) {
                hitCount++
                const damage = 15 + Math.floor(combo * 2)
                target.health = Math.max(0, target.health - damage)
                target.hitFlash = 10
                createParticles(target.mesh.position, 0xff6666, 25, 0.1, 0.8)
                playSound('hit')
                
                // 击退
                const angle = Math.atan2(dz, dx)
                target.velocity.x += Math.cos(angle) * 2.5
                target.velocity.z += Math.sin(angle) * 2.5
                
                if (target.health <= 0) {
                  sceneRef.current?.remove(target.mesh)
                  playersRef.current = playersRef.current.filter(p => p.id !== target.id)
                  const newCombo = combo + 1
                  setCombo(newCombo)
                  setComboTimer(3)
                  setPlayerScore(s => s + 10 + combo * 2)
                  createParticles(target.mesh.position, 0xffaa44, 40, 0.12, 1)
                  if (newCombo >= 3) playSound('combo')
                }
              }
            }
          })
          
          if (hitCount > 0) shakeScreen(0.2 + hitCount * 0.05, 120)
        }
      }
      
      // 更新所有玩家移动
      playersRef.current.forEach(p => {
        // 摩擦力
        p.velocity.x *= 0.94
        p.velocity.z *= 0.94
        
        let newX = p.mesh.position.x + p.velocity.x * delta
        let newZ = p.mesh.position.z + p.velocity.z * delta
        
        // 边界限制
        newX = Math.max(-6.2, Math.min(6.2, newX))
        newZ = Math.max(-6.2, Math.min(6.2, newZ))
        
        p.mesh.position.x = newX
        p.mesh.position.z = newZ
        
        // 弹跳动画
        const bounce = Math.sin(Date.now() * 0.018) * 0.025
        p.mesh.position.y = bounce
        
        // 血量显示（头顶光环）
        const existingRing = p.mesh.children.find(c => c.userData?.isHealthRing)
        if (existingRing) p.mesh.remove(existingRing)
        
        const ringGeo = new THREE.TorusGeometry(0.58, 0.06, 16, 32)
        const ringMat = new THREE.MeshStandardMaterial({ 
          color: p.health > 70 ? 0x44ff44 : p.health > 35 ? 0xffaa44 : 0xff4444,
          emissive: p.health > 70 ? 0x226622 : p.health > 35 ? 0x442200 : 0x441111,
          emissiveIntensity: 0.4
        })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.position.y = 0.95
        ring.userData = { isHealthRing: true }
        p.mesh.add(ring)
      })
      
      // AI 决策
      playersRef.current.forEach(p => {
        if (p.type === 'ai' && !p.isStunned) {
          const attacked = aiMove(p, delta, playersRef.current)
          if (attacked && playersRef.current.find(t => t.id === 'player')) {
            const playerTarget = playersRef.current.find(t => t.id === 'player')!
            const dx = playerTarget.mesh.position.x - p.mesh.position.x
            const dz = playerTarget.mesh.position.z - p.mesh.position.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist < 1.6) {
              const damage = 12
              playerTarget.health = Math.max(0, playerTarget.health - damage)
              playerTarget.hitFlash = 10
              setPlayerHealth(playerTarget.health)
              createParticles(playerTarget.mesh.position, 0xff6666, 20, 0.1, 0.7)
              playSound('hit')
              shakeScreen(0.12, 80)
              
              if (playerTarget.health <= 0) {
                setGameStatus('gameover')
                setWinner(p.name)
                playSound('gameover')
              }
              
              // 击退
              const angle = Math.atan2(dz, dx)
              playerTarget.velocity.x += Math.cos(angle) * 1.8
              playerTarget.velocity.z += Math.sin(angle) * 1.8
            }
          }
        }
      })
      
      // 道具收集
      powerUpsRef.current.forEach(power => {
        if (!power.collected && player) {
          const dist = player.mesh.position.distanceTo(power.mesh.position)
          if (dist < 0.9) {
            power.collected = true
            sceneRef.current?.remove(power.mesh)
            playSound('collect')
            createParticles(power.mesh.position, 0xffaa44, 30, 0.1, 0.6)
            createShockwave(power.mesh.position, 0xffaa44)
            
            if (power.type === 'heal') {
              player.health = Math.min(100, player.health + 25)
              setPlayerHealth(player.health)
              createParticles(player.mesh.position, 0x44ff44, 25, 0.1, 0.5)
            } else if (power.type === 'speed') {
              player.velocity.x *= 2.2
              player.velocity.z *= 2.2
              createParticles(player.mesh.position, 0x44ff44, 20, 0.08, 0.4)
            } else if (power.type === 'freeze') {
              playersRef.current.forEach(p => {
                if (p.id !== 'player') {
                  p.isStunned = true
                  p.stunEndTime = Date.now() + 1800
                  createParticles(p.mesh.position, 0x44aaff, 30, 0.1, 0.6)
                  createShockwave(p.mesh.position, 0x44aaff)
                }
              })
            } else if (power.type === 'bomb') {
              playersRef.current.forEach(p => {
                const distToBomb = p.mesh.position.distanceTo(power.mesh.position)
                if (distToBomb < 2.8) {
                  p.health = Math.max(0, p.health - 28)
                  createParticles(p.mesh.position, 0xff4444, 35, 0.12, 0.9)
                  createShockwave(p.mesh.position, 0xff4444)
                  if (p.id === 'player') setPlayerHealth(p.health)
                  if (p.health <= 0 && p.id !== 'player') {
                    sceneRef.current?.remove(p.mesh)
                    playersRef.current = playersRef.current.filter(p2 => p2.id !== p.id)
                    setPlayerScore(s => s + 10)
                  }
                }
              })
              shakeScreen(0.25, 150)
            }
            setPlayerScore(s => s + 8)
          }
        }
      })
      
      // 更新冲击波
      shockwavesRef.current.forEach((wave, idx) => {
        wave.life++
        const progress = wave.life / wave.maxLife
        const scale = 1 + progress * 3
        wave.mesh.scale.set(scale, scale, scale)
        const mat = wave.mesh.material as THREE.MeshStandardMaterial
        mat.opacity = 1 - progress
        if (wave.life >= wave.maxLife) {
          sceneRef.current?.remove(wave.mesh)
          shockwavesRef.current.splice(idx, 1)
        }
      })
      
      // 屏幕震动
      if (screenShake > 0 && cameraRef.current) {
        const shakeX = (Math.random() - 0.5) * screenShake * 0.2
        const shakeZ = (Math.random() - 0.5) * screenShake * 0.1
        cameraRef.current.position.x = player.mesh.position.x + shakeX
        cameraRef.current.position.z = player.mesh.position.z + 6 + shakeZ
      } else {
        cameraRef.current.position.x += (player.mesh.position.x - cameraRef.current.position.x) * 0.08
        cameraRef.current.position.z = player.mesh.position.z + 6.2
      }
      
      cameraRef.current.lookAt(player.mesh.position)
      
      // 道具动画
      powerUpsRef.current.forEach(power => {
        if (!power.collected) {
          power.mesh.rotation.y += 0.04
          power.mesh.rotation.x = Math.sin(Date.now() * 0.008) * 0.2
          power.mesh.position.y = 0.25 + Math.sin(Date.now() * 0.007) * 0.08
        }
      })
      
      // 漂浮光球动画
      floatingOrbsRef.current.forEach((orb, i) => {
        orb.position.y = 0.6 + Math.sin(Date.now() * 0.003 + i) * 0.15
      })
      
      // 攻击冷却
      if (attackCooldownRef.current > 0) attackCooldownRef.current--
      
      rendererRef.current?.render(sceneRef.current!, cameraRef.current!)
      
      // 检查胜利
      if (playersRef.current.filter(p => p.type === 'ai').length === 0 && gameStatus === 'playing') {
        setGameStatus('gameover')
        setWinner(playerName)
        playSound('victory')
        createVictoryAura(player.mesh.position)
        createParticles(player.mesh.position, 0xffaa44, 80, 0.15, 1.2)
        shakeScreen(0.3, 200)
      }
    }
    
    updateGame()
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [gameStatus])
  
  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing') return
      
      switch(e.key) {
        case 'ArrowLeft': case 'a': keysRef.current.left = true; break
        case 'ArrowRight': case 'd': keysRef.current.right = true; break
        case 'ArrowUp': case 'w': keysRef.current.up = true; break
        case 'ArrowDown': case 's': keysRef.current.down = true; break
        case 'j': case 'J': case ' ':
          e.preventDefault()
          keysRef.current.attack = true
          break
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowLeft': case 'a': keysRef.current.left = false; break
        case 'ArrowRight': case 'd': keysRef.current.right = false; break
        case 'ArrowUp': case 'w': keysRef.current.up = false; break
        case 'ArrowDown': case 's': keysRef.current.down = false; break
        case 'j': case 'J': case ' ':
          keysRef.current.attack = false
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameStatus])

  // 初始化场景
  useEffect(() => {
    if (!containerRef.current) return
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a2a)
    scene.fog = new THREE.FogExp2(0x0a0a2a, 0.02)
    sceneRef.current = scene
    
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 6, 14)
    cameraRef.current = camera
    
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer
    
    initBattleScene()
    
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(window.innerWidth, window.innerHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    
    renderer.render(scene, camera)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
      rendererRef.current?.dispose()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* UI 控制面板 */}
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md rounded-xl p-4 pointer-events-auto border border-white/20 shadow-2xl min-w-[280px]">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-xl font-bold text-white">🥚 蛋仔派对 · 疯狂乱斗</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">✕</button>
        </div>
        
        {gameMode === 'select' ? (
          <>
            <div className="mb-4">
              <p className="text-white text-sm mb-2">🎨 选择你的蛋仔</p>
              <div className="grid grid-cols-3 gap-2">
                {EGG_SKINS.map((skin, idx) => (
                  <button
                    key={skin.id}
                    onClick={() => setSelectedSkin(idx)}
                    className={`p-2 rounded-lg transition ${selectedSkin === idx ? 'bg-yellow-500/50 ring-2 ring-yellow-400' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    <div className="text-2xl">{skin.icon}</div>
                    <div className="text-xs text-white">{skin.name}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-white text-sm mb-2">📝 你的名字</p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 bg-white/20 rounded-lg text-white border border-white/30 focus:outline-none"
                maxLength={12}
              />
            </div>
            
            <div className="mb-4">
              <p className="text-white text-sm mb-2">🤖 AI对手数量: {aiCount}</p>
              <input
                type="range"
                min="1"
                max="8"
                value={aiCount}
                onChange={(e) => setAiCount(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
              </div>
            </div>
            
            <button
              onClick={() => {
                setGameMode('battle')
                startBattle()
              }}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl text-white font-bold text-lg hover:scale-105 transition"
            >
              ⚔️ 开始乱斗
            </button>
            
            <p className="text-gray-400 text-xs text-center mt-3">WASD移动 | J/空格攻击 | 连击加成</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-white mb-3">
              <div>
                <p className="text-xs text-gray-400">❤️ 血量</p>
                <div className="w-full h-2 bg-gray-700 rounded-full mt-1">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all" style={{ width: `${playerHealth}%` }} />
                </div>
                <p className="text-sm mt-1">{playerHealth}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">💰 积分</p>
                <p className="text-xl font-bold text-yellow-400">{playerScore}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">⏱️ 存活时间</p>
                <p className="text-lg font-bold text-green-400">{Math.floor(survivalTime)}s</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">🔥 连击</p>
                <p className="text-lg font-bold text-orange-400">x{combo}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400">🥚 剩余对手</p>
                <p className="text-xl font-bold text-purple-400">{playersRef.current.filter(p => p.id !== 'player').length}</p>
              </div>
            </div>
            
            {gameStatus === 'playing' && (
              <div className="text-center text-white text-xs bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-lg py-2 mb-2">
                ⚡ 连击加成伤害 | 击败AI获得积分
              </div>
            )}
            
            {gameStatus === 'gameover' && (
              <div className="text-center">
                <p className="text-yellow-400 text-xl mb-2 animate-pulse">
                  {winner === playerName ? '🏆 蛋仔冠军! 🏆' : '💀 被击败了...'}
                </p>
                <p className="text-white mb-2">获胜者: {winner}</p>
                <p className="text-white mb-1">🔥 最大连击: x{combo}</p>
                <p className="text-white mb-3">💰 总积分: {playerScore}</p>
                <button
                  onClick={() => {
                    setGameMode('select')
                    setGameStatus('waiting')
                  }}
                  className="w-full py-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white font-bold hover:scale-105 transition"
                >
                  🔄 返回选择
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Combo 特效提示 */}
      {combo >= 3 && gameStatus === 'playing' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-ping">
          <div className="text-4xl font-bold text-orange-400 drop-shadow-lg animate-bounce">
            {combo} COMBO!
          </div>
        </div>
      )}
    </div>
  )
}
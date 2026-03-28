'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Game3DSpaceProps {
  onClose: () => void
}

export default function Game3DSpace({ onClose }: Game3DSpaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 初始化场景、相机、渲染器
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050b1a)
    scene.fog = new THREE.FogExp2(0x050b1a, 0.001)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(0, 1, 6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)

    // 星空粒子系统
    const particlesCount = window.innerWidth < 768 ? 400 : 1000
    const particlesGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particlesCount * 3)
    for (let i = 0; i < particlesCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 20
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particlesMaterial = new THREE.PointsMaterial({
      color: 0x88aaff,
      size: 0.2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    })
    const particles = new THREE.Points(particlesGeometry, particlesMaterial)
    scene.add(particles)

    // 辅助粒子动画
    const particlePositions = positions.slice()
    const particleSpeeds = Array(particlesCount).fill(0).map(() => ({
      y: (Math.random() - 0.5) * 0.01,
      x: (Math.random() - 0.5) * 0.005,
      z: (Math.random() - 0.5) * 0.003
    }))

    // 创建带纹理的材质
    const createFaceTexture = (icon: string, text: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')!
      
      // 背景渐变
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, '#1a2a6c')
      grad.addColorStop(0.5, '#b21f1f')
      grad.addColorStop(1, '#fdbb4d')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // 边框
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 20
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
      
      // 图标
      ctx.fillStyle = 'white'
      ctx.font = `bold ${canvas.width * 0.4}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(icon, canvas.width / 2, canvas.height / 2 - 30)
      
      // 文字
      ctx.font = `${canvas.width * 0.12}px "Microsoft YaHei", sans-serif`
      ctx.fillStyle = '#ffffffcc'
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 80)
      
      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.7 })
    }

    // 立方体
    const materials = [
      createFaceTexture('🤖', 'AI'),      // 右
      createFaceTexture('⚛️', 'React'),   // 左
      createFaceTexture('🐍', 'Python'),  // 上
      createFaceTexture('☕', 'Java'),    // 下
      createFaceTexture('🎨', 'Three'),   // 前
      createFaceTexture('📱', 'Flutter')  // 后
    ]
    const geometry = new THREE.BoxGeometry(2.2, 2.2, 2.2)
    const cube = new THREE.Mesh(geometry, materials)
    scene.add(cube)

    // 环境光 + 点光源
    const ambientLight = new THREE.AmbientLight(0x404060)
    scene.add(ambientLight)
    const pointLight = new THREE.PointLight(0xffffff, 1)
    pointLight.position.set(5, 5, 5)
    scene.add(pointLight)
    const backLight = new THREE.PointLight(0x4466ff, 0.5)
    backLight.position.set(-3, 1, -4)
    scene.add(backLight)

    // 鼠标交互变量
    let targetRotationX = 0
    let targetRotationY = 0
    let currentRotationX = 0
    let currentRotationY = 0

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      targetRotationY = x * 0.5
      targetRotationX = y * 0.3
    }
    window.addEventListener('mousemove', handleMouseMove)

    // 动画循环
    let time = 0
    function animate() {
      requestAnimationFrame(animate)
      time += 0.01

      // 粒子动画：缓慢上下漂浮
      const positionsAttr = particlesGeometry.attributes.position.array
      for (let i = 0; i < particlesCount; i++) {
        positionsAttr[i * 3 + 1] += particleSpeeds[i].y
        positionsAttr[i * 3] += particleSpeeds[i].x
        positionsAttr[i * 3 + 2] += particleSpeeds[i].z
        // 边界重置
        if (positionsAttr[i * 3 + 1] > 50) positionsAttr[i * 3 + 1] = -50
        if (positionsAttr[i * 3] > 100) positionsAttr[i * 3] = -100
        if (positionsAttr[i * 3 + 2] > 30) positionsAttr[i * 3 + 2] = -30
      }
      particlesGeometry.attributes.position.needsUpdate = true

      // 立方体旋转（自动旋转 + 鼠标视差）
      currentRotationX += (targetRotationX - currentRotationX) * 0.05
      currentRotationY += (targetRotationY - currentRotationY) * 0.05
      cube.rotation.x = currentRotationX + Math.sin(time * 0.3) * 0.1
      cube.rotation.y = currentRotationY + time * 0.5
      
      // 粒子整体缓慢旋转
      particles.rotation.y = time * 0.05
      particles.rotation.x = Math.sin(time * 0.1) * 0.1

      renderer.render(scene, camera)
    }
    animate()

    // 响应窗口大小变化
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50">
      {/* 3D 画布容器 */}
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* 个人信息卡片 */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 px-8 shadow-xl border border-white/20 hover:scale-105 transition-transform duration-300">
          <div className="text-center">
            <p className="text-white text-lg font-bold">张三</p>
            <p className="text-gray-300 text-sm">全栈开发 | 3D 创意爱好者</p>
          </div>
        </div>
      </div>
      
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2 transition backdrop-blur-sm"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* 标题 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <h1 className="text-white text-xl font-bold bg-black/30 backdrop-blur-sm px-4 py-1 rounded-full">
          3D 动态空间
        </h1>
      </div>
    </div>
  )
}
// components/GameEggParty.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GameEggPartyProps {
  onClose: () => void;
}

interface Obstacle {
  mesh: THREE.Group;
  type: string;
  active: boolean;
  x: number;
  z: number;
}

interface Coin {
  mesh: THREE.Group;
  active: boolean;
  x: number;
  z: number;
}

export default function GameEggParty({ onClose }: GameEggPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [health, setHealth] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [combo, setCombo] = useState(0);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const groundTilesRef = useRef<THREE.Mesh[]>([]);
  const animationRef = useRef<number>();
  
  // 游戏状态
  const playerXRef = useRef(0);
  const targetXRef = useRef(0);
  const speedRef = useRef(0);
  const comboRef = useRef(0);
  const comboTimeRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const invincibleTimerRef = useRef(0);
  
  // 触摸控制
  const touchStartXRef = useRef(0);
  const leftButtonPressedRef = useRef(false);
  const rightButtonPressedRef = useRef(false);
  
  // 音效系统
  const playSound = (type: 'jump' | 'collect' | 'crash' | 'boost') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.2;
      
      if (type === 'jump') {
        osc.frequency.value = 800;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'collect') {
        osc.frequency.value = 1200;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'crash') {
        osc.frequency.value = 200;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.frequency.value = 600;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.stop(ctx.currentTime + 0.25);
      }
      
      setTimeout(() => {
        try { ctx.close(); } catch(e) {}
      }, 500);
    } catch (e) {}
  };
  
  // 创建跑者角色
  const createRunner = () => {
    const group = new THREE.Group();
    
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, metalness: 0.7, emissive: 0x1166aa });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.5), bodyMat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);
    
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), headMat);
    head.position.y = 0.95;
    head.castShadow = true;
    group.add(head);
    
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.9, emissive: 0x2266aa });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), helmetMat);
    helmet.position.y = 0.95;
    helmet.scale.set(1, 0.85, 1);
    group.add(helmet);
    
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaff });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 24), eyeMat);
    leftEye.position.set(-0.18, 1.05, 0.45);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 24), eyeMat);
    rightEye.position.set(0.18, 1.05, 0.45);
    group.add(rightEye);
    
    const armMat = new THREE.MeshStandardMaterial({ color: 0x44aaff });
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), armMat);
    leftArm.position.set(-0.45, 0.7, 0);
    leftArm.castShadow = true;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), armMat);
    rightArm.position.set(0.45, 0.7, 0);
    rightArm.castShadow = true;
    group.add(rightArm);
    
    const legMat = new THREE.MeshStandardMaterial({ color: 0x44aaff });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.3), legMat);
    leftLeg.position.set(-0.22, 0.22, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.3), legMat);
    rightLeg.position.set(0.22, 0.22, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);
    
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x2288ff, transparent: true, opacity: 0.5 });
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 16, 32), glowMat);
    glowRing.position.y = 0.6;
    group.add(glowRing);
    
    return group;
  };
  
  // 创建障碍物
  const createObstacle = (type: string, x: number, z: number) => {
    let mesh: THREE.Group;
    
    if (type === 'block') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0xcc6644, roughness: 0.5 }));
      box.position.set(x, 0.35, z);
      const group = new THREE.Group();
      group.add(box);
      mesh = group;
    } else {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x886644 }));
      base.position.y = 0.1;
      group.add(base);
      for (let i = -0.2; i <= 0.2; i += 0.2) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xcc8866 }));
        spike.position.set(i, 0.35, 0);
        group.add(spike);
      }
      mesh = group;
      mesh.position.set(x, 0, z);
    }
    
    mesh.castShadow = true;
    return { mesh, type, active: true, x, z };
  };
  
  // 创建金币
  const createCoin = (x: number, z: number) => {
    const coinGroup = new THREE.Group();
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffcc44, metalness: 0.9, emissive: 0xffaa33 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24), coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    coinGroup.add(coin);
    
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), glowMat);
    coinGroup.add(glow);
    
    coinGroup.position.set(x, 0.2, z);
    return coinGroup;
  };
  
  // 创建赛道
  const createTrack = () => {
    if (!sceneRef.current) return;
    
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.7 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    sceneRef.current.add(ground);
    
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.4 });
    const track = new THREE.Mesh(new THREE.PlaneGeometry(4, 200), trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.y = -0.15;
    track.receiveShadow = true;
    sceneRef.current.add(track);
    
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffdd88 });
    for (let z = -40; z <= 40; z += 2) {
      const leftLine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.3), lineMat);
      leftLine.position.set(-1.8, -0.1, z);
      sceneRef.current.add(leftLine);
      groundTilesRef.current.push(leftLine);
      
      const rightLine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.3), lineMat);
      rightLine.position.set(1.8, -0.1, z);
      sceneRef.current.add(rightLine);
      groundTilesRef.current.push(rightLine);
      
      const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.4), lineMat);
      centerLine.position.set(0, -0.1, z);
      sceneRef.current.add(centerLine);
      groundTilesRef.current.push(centerLine);
    }
  };
  
  // 初始化场景
  useEffect(() => {
    if (!containerRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1030);
    scene.fog = new THREE.FogExp2(0x0a1030, 0.01);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 2.2, 6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // 星空
    const starCount = 2000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i*3] = (Math.random() - 0.5) * 200;
      starPos[i*3+1] = (Math.random() - 0.5) * 100;
      starPos[i*3+2] = (Math.random() - 0.5) * 100 - 50;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 }));
    scene.add(stars);
    
    createTrack();
    
    // 玩家在屏幕顶部 (z = 3)
    const player = createRunner();
    player.position.set(0, 0, 3);
    player.castShadow = true;
    scene.add(player);
    playerRef.current = player;
    
    // 装饰树木
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B });
    for (let z = -30; z <= 30; z += 3) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 6), trunkMat);
      trunk.position.set(-2.8, 0.3, z);
      trunk.castShadow = true;
      scene.add(trunk);
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 8), treeMat);
      foliage.position.set(-2.8, 0.75, z);
      foliage.castShadow = true;
      scene.add(foliage);
      
      const trunkR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 6), trunkMat);
      trunkR.position.set(2.8, 0.3, z);
      trunkR.castShadow = true;
      scene.add(trunkR);
      const foliageR = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 8), treeMat);
      foliageR.position.set(2.8, 0.75, z);
      foliageR.castShadow = true;
      scene.add(foliageR);
    }
    
    // 灯光
    const ambientLight = new THREE.AmbientLight(0x446688, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1);
    dirLight.position.set(5, 8, 3);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.PointLight(0xffaa66, 0.5);
    fillLight.position.set(0, 2, 2);
    scene.add(fillLight);
    
    // 障碍物从最远的屏幕底部出现
    for (let i = 0; i < 15; i++) {
      const x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
      const z = -30 - Math.random() * 20;
      const type = Math.random() > 0.6 ? 'block' : 'spike';
      const { mesh, type: t, active, x: px, z: pz } = createObstacle(type, x, z);
      scene.add(mesh);
      obstaclesRef.current.push({ mesh, type: t, active, x: px, z: pz });
    }
    
    // 金币从最远的屏幕底部出现
    for (let i = 0; i < 25; i++) {
      const x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
      const z = -28 - Math.random() * 20;
      const coin = createCoin(x, z);
      scene.add(coin);
      coinsRef.current.push({ mesh: coin, active: true, x, z });
    }
    
    // 触摸滑动控制
    const handleTouchStart = (e: TouchEvent) => {
      touchStartXRef.current = e.touches[0].clientX;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isPlaying || gameOver) return;
      const delta = (e.touches[0].clientX - touchStartXRef.current) / 60;
      targetXRef.current = Math.max(-1.2, Math.min(1.2, delta));
      touchStartXRef.current = e.touches[0].clientX;
    };
    const handleTouchEnd = () => {
      targetXRef.current = 0;
    };
    containerRef.current.addEventListener('touchstart', handleTouchStart);
    containerRef.current.addEventListener('touchmove', handleTouchMove);
    containerRef.current.addEventListener('touchend', handleTouchEnd);
    
    // 键盘控制
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return;
      if (e.key === 'ArrowLeft') targetXRef.current = -1;
      if (e.key === 'ArrowRight') targetXRef.current = 1;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') targetXRef.current = 0;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // 动画循环
    let lastTime = performance.now();
    let armSwing = 0;
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      let delta = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;
      
      if (invincibleTimerRef.current > 0) {
        invincibleTimerRef.current -= delta;
      }
      
      if (comboTimeRef.current > 0) {
        comboTimeRef.current -= delta;
        if (comboTimeRef.current <= 0) {
          comboRef.current = 0;
          setCombo(0);
        }
      }
      
      if (isPlaying && !gameOver && playerRef.current) {
        const newSpeed = 5 + Math.floor(distance / 500);
        speedRef.current = Math.min(12, newSpeed);
        setSpeed(Math.floor(speedRef.current * 12));
        
        // 玩家移动 - 同时支持键盘、滑动、触摸按钮
        let moveTarget = 0;
        if (targetXRef.current !== 0) {
          moveTarget = targetXRef.current;
        } else if (leftButtonPressedRef.current) {
          moveTarget = -1;
        } else if (rightButtonPressedRef.current) {
          moveTarget = 1;
        }
        
        playerXRef.current += (moveTarget - playerXRef.current) * 0.2;
        playerRef.current.position.x = Math.max(-1.3, Math.min(1.3, playerXRef.current));
        
        armSwing += delta * 12;
        const arms = playerRef.current.children.filter(c => 
          (c.position.x === -0.45 || c.position.x === 0.45)
        );
        arms.forEach((arm, i) => {
          arm.rotation.z = Math.sin(armSwing + i) * 0.6;
        });
        
        const scrollSpeed = speedRef.current * 2.5 * delta;
        scrollOffsetRef.current += scrollSpeed;
        
        groundTilesRef.current.forEach((tile, idx) => {
          let z = -40 + (idx * 2) + scrollOffsetRef.current;
          z = ((z % 80) + 80) % 80 - 40;
          tile.position.z = z;
        });
        
        // 障碍物向上移动
        obstaclesRef.current.forEach(ob => {
          ob.z += scrollSpeed;
          ob.mesh.position.z = ob.z;
          
          if (playerRef.current && ob.active && invincibleTimerRef.current <= 0 &&
              Math.abs(playerRef.current.position.x - ob.x) < 0.65 && 
              Math.abs(ob.z - playerRef.current.position.z) < 0.8 && 
              ob.z > 2.2 && ob.z < 3.8) {
            setHealth(h => {
              const newHealth = h - 1;
              if (newHealth <= 0) setGameOver(true);
              return newHealth;
            });
            setCombo(0);
            comboRef.current = 0;
            invincibleTimerRef.current = 1.2;
            playSound('crash');
            
            const flashMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, transparent: true });
            const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), flashMat);
            flash.position.copy(playerRef.current!.position);
            scene.add(flash);
            setTimeout(() => scene.remove(flash), 150);
            
            ob.z = -35 - Math.random() * 20;
            ob.x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
            ob.mesh.position.x = ob.x;
            ob.mesh.position.z = ob.z;
          }
          
          if (ob.z > 5) {
            ob.z = -35 - Math.random() * 20;
            ob.x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
            ob.mesh.position.x = ob.x;
            ob.mesh.position.z = ob.z;
          }
        });
        
        // 金币向上移动
        coinsRef.current.forEach(coin => {
          coin.z += scrollSpeed;
          coin.mesh.position.z = coin.z;
          coin.mesh.rotation.y += 0.1;
          
          if (playerRef.current && coin.active && 
              Math.abs(playerRef.current.position.x - coin.x) < 0.65 && 
              Math.abs(coin.z - playerRef.current.position.z) < 0.7 && 
              coin.z > 2.2 && coin.z < 3.8) {
            coin.active = false;
            coin.mesh.visible = false;
            setScore(s => s + 10);
            setCombo(c => c + 1);
            comboRef.current++;
            comboTimeRef.current = 1.5;
            playSound('collect');
            
            setTimeout(() => {
              coin.z = -32 - Math.random() * 22;
              coin.x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
              coin.mesh.position.x = coin.x;
              coin.mesh.position.z = coin.z;
              coin.active = true;
              coin.mesh.visible = true;
            }, 200);
          }
          
          if (coin.z > 5 && coin.active) {
            coin.z = -32 - Math.random() * 22;
            coin.x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
            coin.mesh.position.x = coin.x;
            coin.mesh.position.z = coin.z;
          }
        });
        
        setDistance(d => d + Math.floor(speedRef.current * delta * 12));
      }
      
      if (playerRef.current && cameraRef.current) {
        const targetX = playerRef.current.position.x * 0.3;
        cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.1;
        cameraRef.current.lookAt(playerRef.current.position.x, 0.8, 2);
      }
      
      stars.rotation.y += 0.001;
      renderer.render(scene, camera);
    };
    
    animate();
    
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (containerRef.current) {
        containerRef.current.removeEventListener('touchstart', handleTouchStart);
        containerRef.current.removeEventListener('touchmove', handleTouchMove);
        containerRef.current.removeEventListener('touchend', handleTouchEnd);
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, [isPlaying, gameOver]);
  
  const startGame = () => {
    setScore(0);
    setDistance(0);
    setHealth(3);
    setCombo(0);
    setGameOver(false);
    setIsPlaying(true);
    playerXRef.current = 0;
    targetXRef.current = 0;
    comboRef.current = 0;
    comboTimeRef.current = 0;
    invincibleTimerRef.current = 0;
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, 3);
      playerRef.current.rotation.set(0, 0, 0);
    }
    obstaclesRef.current.forEach(ob => {
      ob.z = -30 - Math.random() * 20;
      ob.x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
      ob.mesh.position.x = ob.x;
      ob.mesh.position.z = ob.z;
      ob.active = true;
    });
    coinsRef.current.forEach(coin => {
      coin.z = -28 - Math.random() * 20;
      coin.x = [-1.2, 0, 1.2][Math.floor(Math.random() * 3)];
      coin.mesh.position.x = coin.x;
      coin.mesh.position.z = coin.z;
      coin.active = true;
      coin.mesh.visible = true;
    });
    playSound('boost');
  };
  
  const getHearts = () => {
    const safeHealth = Math.max(0, Math.min(3, health));
    return '❤️'.repeat(safeHealth);
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* 退出按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white text-xl hover:bg-red-600 transition"
      >
        ✕
      </button>
      
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 pointer-events-auto border border-white/20">
        <div className="flex gap-4 text-white">
          <div className="text-center">
            <div className="text-xs text-gray-400">💰 金币</div>
            <div className="text-2xl font-bold text-yellow-400">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">🏃 距离</div>
            <div className="text-2xl font-bold text-green-400">{distance}m</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">❤️ 生命</div>
            <div className="text-2xl font-bold text-red-400">{getHearts()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">⚡ 速度</div>
            <div className="text-2xl font-bold text-blue-400">{speed}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">🔥 连击</div>
            <div className="text-2xl font-bold text-orange-400">x{combo}</div>
          </div>
        </div>
      </div>
      
      {!isPlaying && !gameOver && (
        <button
          onClick={startGame}
          className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-full w-24 h-24 flex items-center justify-center shadow-lg active:scale-95 transition border-2 border-white/50"
        >
          <span className="text-4xl">🏃</span>
        </button>
      )}
      
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-black/85 backdrop-blur-md rounded-2xl p-6 text-center min-w-[260px] border border-white/20">
          <p className="text-red-500 text-3xl mb-3">💀 游戏结束</p>
          <p className="text-white text-lg mb-1">💰 获得金币: <span className="text-yellow-400 font-bold">{score}</span></p>
          <p className="text-white text-sm mb-1">🏃 奔跑距离: <span className="text-green-400 font-bold">{distance}m</span></p>
          <p className="text-white text-sm mb-3">🔥 最高连击: <span className="text-orange-400 font-bold">x{combo}</span></p>
          <button onClick={startGame} className="mt-2 bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-2 rounded-full text-white font-bold hover:scale-105 transition">
            重新奔跑
          </button>
        </div>
      )}
      
      {isPlaying && !gameOver && (
        <>
          {/* 原有的操作提示 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-xs whitespace-nowrap bg-black/40 px-3 py-1 rounded-full">
            🎮 左右滑动/方向键移动 | 收集金币 | 躲避障碍物
          </div>
          
          {/* 左箭头触摸按钮 */}
          <button
            onTouchStart={() => { leftButtonPressedRef.current = true; }}
            onTouchEnd={() => { leftButtonPressedRef.current = false; }}
            onMouseDown={() => { leftButtonPressedRef.current = true; }}
            onMouseUp={() => { leftButtonPressedRef.current = false; }}
            onMouseLeave={() => { leftButtonPressedRef.current = false; }}
            className="absolute bottom-20 left-8 z-20 w-16 h-16 rounded-full bg-black/50 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white text-3xl active:scale-95 transition"
          >
            ◀
          </button>
          
          {/* 右箭头触摸按钮 */}
          <button
            onTouchStart={() => { rightButtonPressedRef.current = true; }}
            onTouchEnd={() => { rightButtonPressedRef.current = false; }}
            onMouseDown={() => { rightButtonPressedRef.current = true; }}
            onMouseUp={() => { rightButtonPressedRef.current = false; }}
            onMouseLeave={() => { rightButtonPressedRef.current = false; }}
            className="absolute bottom-20 right-8 z-20 w-16 h-16 rounded-full bg-black/50 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white text-3xl active:scale-95 transition"
          >
            ▶
          </button>
        </>
      )}
      
      {combo >= 3 && isPlaying && !gameOver && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 pointer-events-none animate-pulse">
          <div className="text-4xl font-bold text-orange-400 drop-shadow-lg tracking-wider">
            {combo} COMBO!
          </div>
        </div>
      )}
    </div>
  );
}
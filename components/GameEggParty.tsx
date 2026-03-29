// components/GameEggParty.tsx
// 版本 v2.0 - 2024年3月29日更新
'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GameEggPartyProps {
  onClose: () => void;
}

export default function GameEggParty({ onClose }: GameEggPartyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [combo, setCombo] = useState(0);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const enemiesRef = useRef<THREE.Group[]>([]);
  const powerupsRef = useRef<THREE.Group[]>([]);
  const animationRef = useRef<number>();
  
  // 游戏状态
  const playerPosRef = useRef({ x: 0, z: 0 });
  const keysRef = useRef({ w: false, s: false, a: false, d: false });
  const attackCooldownRef = useRef(0);
  const comboRef = useRef(0);
  const comboTimeRef = useRef(0);
  
  // 音效
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const playSound = (type: 'attack' | 'hit' | 'collect' | 'start') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.15;
      
      if (type === 'attack') {
        osc.frequency.value = 500;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'hit') {
        osc.frequency.value = 200;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'collect') {
        osc.frequency.value = 800;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.frequency.value = 600;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.stop(ctx.currentTime + 0.25);
      }
      setTimeout(() => ctx.close(), 500);
    } catch (e) {}
  };
  
  // 显示血量
  const getHearts = () => {
    const safeHealth = Math.max(0, Math.min(3, health));
    return '❤️'.repeat(safeHealth);
  };
  
  // 创建蛋仔角色
  const createEggz = (color: number, isPlayer: boolean = false) => {
    const group = new THREE.Group();
    
    // 身体
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 48, 48), bodyMat);
    body.scale.set(1, 1.05, 0.95);
    body.castShadow = true;
    group.add(body);
    
    // 腮红
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
    const leftBlush = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), blushMat);
    leftBlush.position.set(-0.45, -0.05, 0.6);
    group.add(leftBlush);
    const rightBlush = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), blushMat);
    rightBlush.position.set(0.45, -0.05, 0.6);
    group.add(rightBlush);
    
    // 眼睛
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 32), eyeWhiteMat);
    leftEye.position.set(-0.28, 0.28, 0.68);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 32), eyeWhiteMat);
    rightEye.position.set(0.28, 0.28, 0.68);
    group.add(rightEye);
    
    // 瞳孔
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 32), pupilMat);
    leftPupil.position.set(-0.28, 0.25, 0.85);
    group.add(leftPupil);
    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 32), pupilMat);
    rightPupil.position.set(0.28, 0.25, 0.85);
    group.add(rightPupil);
    
    // 高光
    const highlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), highlightMat);
    leftHighlight.position.set(-0.32, 0.34, 0.92);
    group.add(leftHighlight);
    const rightHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), highlightMat);
    rightHighlight.position.set(0.24, 0.34, 0.92);
    group.add(rightHighlight);
    
    // 嘴巴
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xcc8866 });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 16, 32, Math.PI), mouthMat);
    mouth.rotation.x = 0.15;
    mouth.rotation.z = 0.1;
    mouth.position.set(0, 0.05, 0.82);
    group.add(mouth);
    
    if (isPlayer) {
      // 玩家皇冠
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0x442200 });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.15, 8), crownMat);
      crownBase.position.set(0, 0.85, 0);
      group.add(crownBase);
      
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0xffaa33 });
      for (let i = -0.2; i <= 0.2; i += 0.2) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), spikeMat);
        spike.position.set(i, 0.98, 0);
        group.add(spike);
      }
    } else {
      // 敌人小帽子
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xaa6666 });
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.35, 8), hatMat);
      hat.position.set(0, 0.82, 0);
      group.add(hat);
      
      const hatBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffaa88 }));
      hatBall.position.set(0, 1.0, 0);
      group.add(hatBall);
    }
    
    return group;
  };
  
  // 创建道具
  const createPowerup = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const candyMat = new THREE.MeshStandardMaterial({ color: 0xff66cc, emissive: 0x331122 });
    const candy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), candyMat);
    candy.castShadow = true;
    group.add(candy);
    
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 16, 32), stripeMat);
    stripe.rotation.x = Math.PI / 2;
    group.add(stripe);
    
    group.position.copy(pos);
    return group;
  };
  
  // 创建爆炸特效
  const createExplosion = (position: THREE.Vector3) => {
    if (!sceneRef.current) return;
    for (let i = 0; i < 25; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff4422 })
      );
      particle.position.copy(position);
      sceneRef.current.add(particle);
      
      const vel = new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
      let life = 0;
      const animateParticle = () => {
        particle.position.x += vel.x;
        particle.position.y += vel.y;
        particle.position.z += vel.z;
        life++;
        if (life < 35) requestAnimationFrame(animateParticle);
        else sceneRef.current?.remove(particle);
      };
      requestAnimationFrame(animateParticle);
    }
  };
  
  // 攻击特效
  const createAttackEffect = (position: THREE.Vector3) => {
    if (!sceneRef.current) return;
    const ringGeo = new THREE.SphereGeometry(1.2, 24, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffaa55, emissive: 0xff4400, transparent: true, opacity: 0.8 });
    const shockwave = new THREE.Mesh(ringGeo, ringMat);
    shockwave.position.copy(position);
    sceneRef.current.add(shockwave);
    
    let scale = 0.3;
    const animateShock = () => {
      scale += 0.08;
      shockwave.scale.set(scale, scale, scale);
      if (shockwave.material) shockwave.material.opacity -= 0.025;
      if (scale < 2.5) {
        requestAnimationFrame(animateShock);
      } else {
        sceneRef.current?.remove(shockwave);
      }
    };
    requestAnimationFrame(animateShock);
  };
  
  // 初始化场景
  useEffect(() => {
    if (!containerRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2a4a);
    scene.fog = new THREE.FogExp2(0x1a2a4a, 0.015);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(8, 7, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // 星空粒子系统
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
    
    // 动态星云效果
    const nebulaCount = 500;
    const nebulaGeo = new THREE.BufferGeometry();
    const nebulaPos = new Float32Array(nebulaCount * 3);
    const nebulaColors = new Float32Array(nebulaCount * 3);
    for (let i = 0; i < nebulaCount; i++) {
      nebulaPos[i*3] = (Math.random() - 0.5) * 80;
      nebulaPos[i*3+1] = (Math.random() - 0.5) * 40;
      nebulaPos[i*3+2] = (Math.random() - 0.5) * 60 - 30;
      nebulaColors[i*3] = Math.random() * 0.5 + 0.5;
      nebulaColors[i*3+1] = Math.random() * 0.3;
      nebulaColors[i*3+2] = Math.random() * 0.8;
    }
    nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPos, 3));
    nebulaGeo.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3));
    const nebulaMat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.6 });
    const nebula = new THREE.Points(nebulaGeo, nebulaMat);
    scene.add(nebula);
    
    // 灯光
    const ambientLight = new THREE.AmbientLight(0x446688, 0.55);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    mainLight.position.set(5, 10, 4);
    mainLight.castShadow = true;
    scene.add(mainLight);
    
    const fillLight = new THREE.PointLight(0xffaa66, 0.5);
    fillLight.position.set(0, 3, 2);
    scene.add(fillLight);
    
    // 地面
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.5 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 32), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // 网格
    const gridHelper = new THREE.GridHelper(14, 20, 0xffaa88, 0x88aaff);
    gridHelper.position.y = -0.45;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.4;
    scene.add(gridHelper);
    
    // 玩家
    const player = createEggz(0xffaa66, true);
    player.position.set(0, 0, 0);
    player.castShadow = true;
    scene.add(player);
    playerRef.current = player;
    
    // 敌人
    const enemyColors = [0xff8888, 0x88ff88, 0x8888ff, 0xffaa88, 0xaaffaa, 0xffaaff];
    for (let i = 0; i < 6; i++) {
      const enemy = createEggz(enemyColors[i % enemyColors.length], false);
      const angle = (i / 6) * Math.PI * 2;
      enemy.position.set(Math.cos(angle) * 4.5, 0, Math.sin(angle) * 4.5);
      enemy.castShadow = true;
      scene.add(enemy);
      enemiesRef.current.push(enemy);
    }
    
    // 道具
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 2;
      const pos = new THREE.Vector3(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
      const powerup = createPowerup(pos);
      scene.add(powerup);
      powerupsRef.current.push(powerup);
    }
    
    // 键盘控制
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') keysRef.current.w = true;
      if (key === 's') keysRef.current.s = true;
      if (key === 'a') keysRef.current.a = true;
      if (key === 'd') keysRef.current.d = true;
      if (key === ' ' && isPlaying && !gameOver && attackCooldownRef.current <= 0) {
        e.preventDefault();
        attackCooldownRef.current = 0.5;
        if (playerRef.current) {
          createAttackEffect(playerRef.current.position);
          playSound('attack');
          
          let hitCount = 0;
          enemiesRef.current.forEach((enemy, idx) => {
            if (playerRef.current && playerRef.current.position.distanceTo(enemy.position) < 1.8) {
              hitCount++;
              setScore(s => s + 10);
              setCombo(c => c + 1);
              comboRef.current++;
              comboTimeRef.current = 1.5;
              createExplosion(enemy.position);
              playSound('collect');
              
              const direction = new THREE.Vector3().subVectors(enemy.position, playerRef.current.position).normalize();
              enemy.position.x += direction.x * 2.5;
              enemy.position.z += direction.z * 2.5;
              
              setTimeout(() => {
                const angle2 = Math.random() * Math.PI * 2;
                enemy.position.set(Math.cos(angle2) * 4.5, 0, Math.sin(angle2) * 4.5);
              }, 200);
            }
          });
          
          if (hitCount > 0) {
            setCombo(comboRef.current);
          }
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') keysRef.current.w = false;
      if (key === 's') keysRef.current.s = false;
      if (key === 'a') keysRef.current.a = false;
      if (key === 'd') keysRef.current.d = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // 动画循环
    let lastTime = performance.now();
    let starRotation = 0;
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      let delta = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;
      
      // 连击衰减
      if (comboTimeRef.current > 0) {
        comboTimeRef.current -= delta;
        if (comboTimeRef.current <= 0) {
          comboRef.current = 0;
          setCombo(0);
        }
      }
      
      // 攻击冷却
      if (attackCooldownRef.current > 0) attackCooldownRef.current -= delta;
      
      if (isPlaying && !gameOver && playerRef.current) {
        // 移动
        let moveX = 0, moveZ = 0;
        if (keysRef.current.a) moveX -= 1;
        if (keysRef.current.d) moveX += 1;
        if (keysRef.current.w) moveZ -= 1;
        if (keysRef.current.s) moveZ += 1;
        
        if (moveX !== 0 || moveZ !== 0) {
          const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
          moveX /= len;
          moveZ /= len;
          
          playerPosRef.current.x += moveX * 5.5 * delta;
          playerPosRef.current.z += moveZ * 5.5 * delta;
          
          const limit = 5.5;
          playerPosRef.current.x = Math.max(-limit, Math.min(limit, playerPosRef.current.x));
          playerPosRef.current.z = Math.max(-limit, Math.min(limit, playerPosRef.current.z));
          
          playerRef.current.position.x = playerPosRef.current.x;
          playerRef.current.position.z = playerPosRef.current.z;
          
          const angle = Math.atan2(moveX, moveZ);
          playerRef.current.rotation.y = angle;
        }
        
        // 敌人AI
        enemiesRef.current.forEach(enemy => {
          const toPlayer = new THREE.Vector3().subVectors(playerRef.current!.position, enemy.position);
          if (toPlayer.length() > 0.3) {
            const dir = toPlayer.clone().normalize();
            enemy.position.x += dir.x * 2.8 * delta;
            enemy.position.z += dir.z * 2.8 * delta;
            
            const limit = 6;
            enemy.position.x = Math.max(-limit, Math.min(limit, enemy.position.x));
            enemy.position.z = Math.max(-limit, Math.min(limit, enemy.position.z));
            enemy.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
          }
        });
        
        // 碰撞伤害
        enemiesRef.current.forEach((enemy) => {
          if (playerRef.current && playerRef.current.position.distanceTo(enemy.position) < 0.85) {
            setHealth(h => Math.max(0, h - 1));
            setCombo(0);
            comboRef.current = 0;
            playSound('hit');
            
            const direction = new THREE.Vector3().subVectors(playerRef.current!.position, enemy.position).normalize();
            playerPosRef.current.x += direction.x * 1.2;
            playerPosRef.current.z += direction.z * 1.2;
            playerRef.current.position.x = playerPosRef.current.x;
            playerRef.current.position.z = playerPosRef.current.z;
            
            enemy.position.x -= direction.x * 1.2;
            enemy.position.z -= direction.z * 1.2;
          }
        });
        
        // 检查游戏结束
        if (health <= 0) {
          setGameOver(true);
          setIsPlaying(false);
        }
        
        // 道具拾取
        powerupsRef.current.forEach((powerup, idx) => {
          if (playerRef.current && playerRef.current.position.distanceTo(powerup.position) < 0.7) {
            scene.remove(powerup);
            powerupsRef.current.splice(idx, 1);
            setScore(s => s + 25);
            createExplosion(powerup.position);
            playSound('collect');
            
            const angle = Math.random() * Math.PI * 2;
            const radius = 3 + Math.random() * 2.5;
            const pos = new THREE.Vector3(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
            const newPowerup = createPowerup(pos);
            scene.add(newPowerup);
            powerupsRef.current.push(newPowerup);
          }
        });
      }
      
      // 道具动画
      powerupsRef.current.forEach(p => {
        p.rotation.y += 0.02;
        p.position.y = 0.2 + Math.sin(Date.now() * 0.005) * 0.08;
      });
      
      // 相机跟随
      if (playerRef.current && cameraRef.current) {
        const targetX = playerRef.current.position.x * 0.6;
        const targetZ = playerRef.current.position.z * 0.6 + 11;
        cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.08;
        cameraRef.current.position.z += (targetZ - cameraRef.current.position.z) * 0.08;
        cameraRef.current.lookAt(playerRef.current.position);
      }
      
      // 星空旋转
      starRotation += 0.001;
      stars.rotation.y = starRotation;
      nebula.rotation.y = starRotation * 0.3;
      
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
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, [isPlaying, gameOver, health]);
  
  const startGame = () => {
    setScore(0);
    setHealth(3);
    setCombo(0);
    setGameOver(false);
    setIsPlaying(true);
    playerPosRef.current = { x: 0, z: 0 };
    comboRef.current = 0;
    comboTimeRef.current = 0;
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, 0);
      playerRef.current.rotation.set(0, 0, 0);
    }
    enemiesRef.current.forEach((enemy, i) => {
      const angle = (i / enemiesRef.current.length) * Math.PI * 2;
      enemy.position.set(Math.cos(angle) * 4.5, 0, Math.sin(angle) * 4.5);
    });
    playSound('start');
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div ref={containerRef} className="absolute inset-0" />
      
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white text-xl hover:bg-red-600 transition"
      >
        ✕
      </button>
      
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 pointer-events-auto border border-white/20">
        <div className="flex gap-4 text-white">
          <div className="text-center">
            <div className="text-xs text-gray-400">🎯 得分</div>
            <div className="text-2xl font-bold text-yellow-400">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">❤️ 生命</div>
            <div className="text-2xl font-bold text-red-400">{getHearts()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">⚡ 连击</div>
            <div className="text-2xl font-bold text-orange-400">x{combo}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">👾 敌人</div>
            <div className="text-2xl font-bold text-green-400">{enemiesRef.current.length}</div>
          </div>
        </div>
      </div>
      
      {!isPlaying && !gameOver && (
        <button
          onClick={startGame}
          className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-full w-24 h-24 flex items-center justify-center shadow-lg active:scale-95 transition border-2 border-white/50"
        >
          <span className="text-4xl">🥚</span>
        </button>
      )}
      
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-black/85 backdrop-blur-md rounded-2xl p-6 text-center min-w-[260px] border border-white/20">
          <p className="text-red-500 text-3xl mb-3">💀 游戏结束</p>
          <p className="text-white text-lg mb-1">💰 获得金币: <span className="text-yellow-400 font-bold">{score}</span></p>
          <p className="text-white text-sm mb-1">🔥 最高连击: <span className="text-orange-400 font-bold">x{combo}</span></p>
          <button onClick={startGame} className="mt-2 bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-2 rounded-full text-white font-bold hover:scale-105 transition">
            重新开始
          </button>
        </div>
      )}
      
      {isPlaying && !gameOver && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-xs whitespace-nowrap bg-black/40 px-3 py-1 rounded-full">
          🎮 WASD 移动 | 空格攻击 | 连击越高得分越多 | 躲避敌人
        </div>
      )}
      
      {combo >= 3 && isPlaying && !gameOver && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 pointer-events-none animate-pulse">
          <div className="text-5xl font-bold text-orange-400 drop-shadow-lg tracking-wider">
            {combo} COMBO!
          </div>
        </div>
      )}
    </div>
  );
}
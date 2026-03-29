// components/GameSpaceShooter.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GameSpaceShooterProps {
  onClose: () => void;
}

interface Enemy {
  mesh: THREE.Group;
  health: number;
  speed: number;
  type: string;
}

interface Bullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

export default function GameSpaceShooter({ onClose }: GameSpaceShooterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wave, setWave] = useState(1);
  const [combo, setCombo] = useState(0);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<THREE.Mesh[]>([]);
  const animationRef = useRef<number>();
  
  // 游戏状态
  const playerPosRef = useRef({ x: 0, y: -3 });
  const keysRef = useRef({ left: false, right: false, up: false, down: false, shoot: false });
  const shootCooldownRef = useRef(0);
  const comboRef = useRef(0);
  const comboTimeRef = useRef(0);
  const enemiesKilledRef = useRef(0);
  
  // 音效系统 - 使用简单的 web audio，每次创建新节点
  const playSound = (type: 'shoot' | 'explosion' | 'hit') => {
    try {
      // 每次播放创建新的 AudioContext
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.15;
      
      if (type === 'shoot') {
        osc.frequency.value = 1200;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'explosion') {
        osc.frequency.value = 150;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'hit') {
        osc.frequency.value = 350;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.stop(ctx.currentTime + 0.2);
      }
      
      // 自动关闭上下文
      setTimeout(() => {
        try { ctx.close(); } catch(e) {}
      }, 500);
    } catch (e) {
      // 静默失败，不影响游戏
    }
  };
  
  // 创建玩家战机
  const createPlayerShip = () => {
    const group = new THREE.Group();
    
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x33aaff, metalness: 0.85, roughness: 0.2, emissive: 0x1166aa, emissiveIntensity: 0.3 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 16), bodyMat);
    body.position.y = 0.2;
    group.add(body);
    
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x33aaff, metalness: 0.8 });
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.6), wingMat);
    leftWing.position.set(-0.7, 0, -0.2);
    leftWing.rotation.z = -0.3;
    group.add(leftWing);
    
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.6), wingMat);
    rightWing.position.set(0.7, 0, -0.2);
    rightWing.rotation.z = 0.3;
    group.add(rightWing);
    
    const engineMat = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff4422, emissiveIntensity: 0.6 });
    const leftEngine = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.4, 8), engineMat);
    leftEngine.position.set(-0.4, -0.1, -0.85);
    group.add(leftEngine);
    
    const rightEngine = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.4, 8), engineMat);
    rightEngine.position.set(0.4, -0.1, -0.85);
    group.add(rightEngine);
    
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.95, emissive: 0x2266aa });
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), cockpitMat);
    cockpit.position.set(0, 0.18, 0.65);
    group.add(cockpit);
    
    return group;
  };
  
  // 创建敌人
  const createEnemy = (type: string, x: number, y: number) => {
    const group = new THREE.Group();
    let color, size, health;
    
    if (type === 'scout') {
      color = 0xff6666;
      size = 0.4;
      health = 1;
    } else if (type === 'fighter') {
      color = 0xff4444;
      size = 0.55;
      health = 2;
    } else {
      color = 0xaa44ff;
      size = 0.7;
      health = 3;
    }
    
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, emissive: 0x441111 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(size, size * 1.2, 12), bodyMat);
    body.rotation.x = -Math.PI / 2;
    group.add(body);
    
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 16, 16), eyeMat);
    leftEye.position.set(-size * 0.35, size * 0.25, -size * 0.6);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 16, 16), eyeMat);
    rightEye.position.set(size * 0.35, size * 0.25, -size * 0.6);
    group.add(rightEye);
    
    const wingMat = new THREE.MeshStandardMaterial({ color: color });
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(size * 0.5, 0.08, size * 0.4), wingMat);
    leftWing.position.set(-size * 0.6, 0, size * 0.1);
    group.add(leftWing);
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(size * 0.5, 0.08, size * 0.4), wingMat);
    rightWing.position.set(size * 0.6, 0, size * 0.1);
    group.add(rightWing);
    
    group.position.set(x, y, 0);
    return { mesh: group, health, type, speed: type === 'scout' ? 3 : type === 'fighter' ? 2 : 1.5 };
  };
  
  // 创建子弹
  const createBullet = (pos: THREE.Vector3) => {
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff4422, emissiveIntensity: 0.8 });
    const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), bulletMat);
    bullet.rotation.x = Math.PI / 2;
    bullet.position.copy(pos);
    bullet.position.y += 0.8;
    return { mesh: bullet, velocity: new THREE.Vector3(0, 6, 0) };
  };
  
  // 创建爆炸特效
  const createExplosion = (position: THREE.Vector3, size: number = 1) => {
    if (!sceneRef.current) return;
    const particleCount = Math.floor(30 * size);
    for (let i = 0; i < particleCount; i++) {
      const particleMat = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff4422 });
      const particle = new THREE.Mesh(new THREE.SphereGeometry(0.08 * size, 6, 6), particleMat);
      particle.position.copy(position);
      sceneRef.current.add(particle);
      particlesRef.current.push(particle);
      
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5
      );
      let life = 0;
      const animateParticle = () => {
        particle.position.x += vel.x;
        particle.position.y += vel.y;
        particle.position.z += vel.z;
        particle.scale.multiplyScalar(0.95);
        life++;
        if (life < 40) requestAnimationFrame(animateParticle);
        else {
          sceneRef.current?.remove(particle);
          particlesRef.current = particlesRef.current.filter(p => p !== particle);
        }
      };
      requestAnimationFrame(animateParticle);
    }
    
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffaa66, emissive: 0xff4422, transparent: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 16, 32), ringMat);
    ring.position.copy(position);
    sceneRef.current.add(ring);
    let scale = 1;
    const animateRing = () => {
      scale += 0.15;
      ring.scale.set(scale, scale, scale);
      if (ring.material) ring.material.opacity = 1 - scale / 5;
      if (scale < 5) requestAnimationFrame(animateRing);
      else sceneRef.current?.remove(ring);
    };
    requestAnimationFrame(animateRing);
  };
  
  // 初始化场景
  useEffect(() => {
    if (!containerRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050b20);
    scene.fog = new THREE.FogExp2(0x050b20, 0.008);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // 星空粒子系统
    const starCount = 3000;
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
    
    // 玩家
    const player = createPlayerShip();
    player.position.set(0, -3, 0);
    scene.add(player);
    playerRef.current = player;
    
    // 灯光
    const ambientLight = new THREE.AmbientLight(0x224466, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.PointLight(0xffaa66, 0.5);
    fillLight.position.set(0, 2, 2);
    scene.add(fillLight);
    
    // 初始敌人
    for (let i = 0; i < 8; i++) {
      const type = Math.random() > 0.7 ? 'fighter' : 'scout';
      const x = (Math.random() - 0.5) * 6;
      const y = 3 + Math.random() * 4;
      const enemy = createEnemy(type, x, y);
      scene.add(enemy.mesh);
      enemiesRef.current.push(enemy);
    }
    
    // 键盘控制
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'ArrowLeft') keysRef.current.left = true;
      if (key === 'ArrowRight') keysRef.current.right = true;
      if (key === 'ArrowUp') keysRef.current.up = true;
      if (key === 'ArrowDown') keysRef.current.down = true;
      if (key === ' ' || key === 'Space') {
        e.preventDefault();
        keysRef.current.shoot = true;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'ArrowLeft') keysRef.current.left = false;
      if (key === 'ArrowRight') keysRef.current.right = false;
      if (key === 'ArrowUp') keysRef.current.up = false;
      if (key === 'ArrowDown') keysRef.current.down = false;
      if (key === ' ' || key === 'Space') keysRef.current.shoot = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // 动画循环
    let lastTime = performance.now();
    let starRotation = 0;
    let waveTimer = 0;
    
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
      
      if (isPlaying && !gameOver && playerRef.current) {
        // 玩家移动
        let moveX = 0, moveY = 0;
        if (keysRef.current.left) moveX -= 1;
        if (keysRef.current.right) moveX += 1;
        if (keysRef.current.up) moveY += 1;
        if (keysRef.current.down) moveY -= 1;
        
        if (moveX !== 0 || moveY !== 0) {
          const len = Math.sqrt(moveX * moveX + moveY * moveY);
          moveX /= len;
          moveY /= len;
          
          playerPosRef.current.x += moveX * 6 * delta;
          playerPosRef.current.y += moveY * 6 * delta;
          
          const limitX = 4.5;
          const limitY = 2.5;
          playerPosRef.current.x = Math.max(-limitX, Math.min(limitX, playerPosRef.current.x));
          playerPosRef.current.y = Math.max(-4, Math.min(limitY, playerPosRef.current.y));
          
          playerRef.current.position.x = playerPosRef.current.x;
          playerRef.current.position.y = playerPosRef.current.y;
          
          playerRef.current.rotation.z = playerPosRef.current.x * -0.15;
        }
        
        // 射击
        if (keysRef.current.shoot && shootCooldownRef.current <= 0) {
          const bullet = createBullet(playerRef.current.position);
          scene.add(bullet.mesh);
          bulletsRef.current.push(bullet);
          shootCooldownRef.current = 6;
          playSound('shoot');
        }
        if (shootCooldownRef.current > 0) shootCooldownRef.current -= delta * 60;
        
        // 更新子弹
        bulletsRef.current.forEach((bullet, idx) => {
          bullet.mesh.position.y += bullet.velocity.y * delta;
          
          if (bullet.mesh.position.y > 6 || bullet.mesh.position.y < -5 ||
              Math.abs(bullet.mesh.position.x) > 7) {
            scene.remove(bullet.mesh);
            bulletsRef.current.splice(idx, 1);
          }
        });
        
        // 更新敌人
        enemiesRef.current.forEach((enemy, enemyIdx) => {
          enemy.mesh.position.y -= enemy.speed * delta * 2;
          
          if (enemy.mesh.position.y < -4.5) {
            scene.remove(enemy.mesh);
            enemiesRef.current.splice(enemyIdx, 1);
            return;
          }
          
          // 玩家碰撞
          if (playerRef.current && Math.abs(playerRef.current.position.x - enemy.mesh.position.x) < 0.8 &&
              Math.abs(playerRef.current.position.y - enemy.mesh.position.y) < 0.8) {
            setHealth(h => {
              const newHealth = h - 1;
              if (newHealth <= 0) setGameOver(true);
              return newHealth;
            });
            setCombo(0);
            comboRef.current = 0;
            createExplosion(enemy.mesh.position, 1);
            playSound('hit');
            scene.remove(enemy.mesh);
            enemiesRef.current.splice(enemyIdx, 1);
          }
          
          // 子弹碰撞
          bulletsRef.current.forEach((bullet, bulletIdx) => {
            if (Math.abs(bullet.mesh.position.x - enemy.mesh.position.x) < 0.6 &&
                Math.abs(bullet.mesh.position.y - enemy.mesh.position.y) < 0.6) {
              scene.remove(bullet.mesh);
              bulletsRef.current.splice(bulletIdx, 1);
              enemy.health--;
              
              if (enemy.health <= 0) {
                const points = enemy.type === 'scout' ? 10 : enemy.type === 'fighter' ? 20 : 50;
                setScore(s => s + points);
                setCombo(c => c + 1);
                comboRef.current++;
                comboTimeRef.current = 1.5;
                enemiesKilledRef.current++;
                createExplosion(enemy.mesh.position, 0.8);
                playSound('explosion');
                scene.remove(enemy.mesh);
                enemiesRef.current.splice(enemyIdx, 1);
              } else {
                enemy.mesh.children.forEach(child => {
                  if (child instanceof THREE.Mesh && child.material) {
                    child.material.color.setHex(0xff8888);
                    setTimeout(() => {
                      if (child.material) child.material.color.setHex(0xff4444);
                    }, 100);
                  }
                });
              }
            }
          });
        });
        
        // 生成新敌人
        waveTimer += delta;
        if (enemiesRef.current.length < 12 && waveTimer > 1) {
          waveTimer = 0;
          const newWave = Math.floor(enemiesKilledRef.current / 10) + 1;
          setWave(newWave);
          
          const enemyCount = Math.min(6 + newWave, 12);
          for (let i = 0; i < enemyCount; i++) {
            let type = 'scout';
            const rand = Math.random();
            if (newWave > 2 && rand < 0.3) type = 'heavy';
            else if (rand < 0.6) type = 'fighter';
            
            const x = (Math.random() - 0.5) * 7;
            const y = 5 + Math.random() * 2;
            const enemy = createEnemy(type, x, y);
            scene.add(enemy.mesh);
            enemiesRef.current.push(enemy);
          }
        }
      }
      
      // 相机跟随
      if (playerRef.current && cameraRef.current) {
        const targetX = playerRef.current.position.x * 0.3;
        cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.1;
        cameraRef.current.lookAt(playerRef.current.position.x * 0.5, playerRef.current.position.y * 0.3, 0);
      }
      
      // 星空旋转
      starRotation += 0.0005;
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
  }, [isPlaying, gameOver]);
  
  const startGame = () => {
    setScore(0);
    setHealth(5);
    setWave(1);
    setCombo(0);
    setGameOver(false);
    setIsPlaying(true);
    playerPosRef.current = { x: 0, y: -3 };
    comboRef.current = 0;
    comboTimeRef.current = 0;
    enemiesKilledRef.current = 0;
    if (playerRef.current) {
      playerRef.current.position.set(0, -3, 0);
      playerRef.current.rotation.set(0, 0, 0);
    }
    enemiesRef.current.forEach(e => sceneRef.current?.remove(e.mesh));
    enemiesRef.current = [];
    bulletsRef.current.forEach(b => sceneRef.current?.remove(b.mesh));
    bulletsRef.current = [];
    
    for (let i = 0; i < 8; i++) {
      const type = Math.random() > 0.7 ? 'fighter' : 'scout';
      const x = (Math.random() - 0.5) * 6;
      const y = 3 + Math.random() * 4;
      const enemy = createEnemy(type, x, y);
      sceneRef.current?.add(enemy.mesh);
      enemiesRef.current.push(enemy);
    }
    playSound('shoot');
  };
  
  const getHearts = () => '❤️'.repeat(Math.max(0, Math.min(5, health)));
  
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
            <div className="text-xs text-gray-400">🌊 波次</div>
            <div className="text-2xl font-bold text-blue-400">{wave}</div>
          </div>
        </div>
      </div>
      
      {!isPlaying && !gameOver && (
        <button
          onClick={startGame}
          className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-full w-24 h-24 flex items-center justify-center shadow-lg active:scale-95 transition border-2 border-white/50"
        >
          <span className="text-4xl">🚀</span>
        </button>
      )}
      
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-black/85 backdrop-blur-md rounded-2xl p-6 text-center min-w-[260px] border border-white/20">
          <p className="text-red-500 text-3xl mb-3">💀 游戏结束</p>
          <p className="text-white text-lg mb-1">得分: <span className="text-yellow-400 font-bold">{score}</span></p>
          <p className="text-white text-sm mb-1">波次: <span className="text-blue-400 font-bold">{wave}</span></p>
          <p className="text-white text-sm mb-3">最高连击: <span className="text-orange-400 font-bold">x{combo}</span></p>
          <button onClick={startGame} className="mt-2 bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-2 rounded-full text-white font-bold hover:scale-105 transition">
            重新出征
          </button>
        </div>
      )}
      
      {isPlaying && !gameOver && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-xs whitespace-nowrap bg-black/40 px-3 py-1 rounded-full">
          🎮 方向键移动 | 空格射击 | 连击加成得分 | 波次递增难度
        </div>
      )}
      
      {combo >= 5 && isPlaying && !gameOver && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 pointer-events-none animate-pulse">
          <div className="text-4xl font-bold text-orange-400 drop-shadow-lg tracking-wider">
            {combo} COMBO!
          </div>
        </div>
      )}
    </div>
  );
}
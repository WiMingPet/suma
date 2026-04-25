// lib/sounds.ts

class SoundManager {
  private static instance: SoundManager
  private audioContext: AudioContext | null = null
  private initialized = false

  static getInstance() {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  // 必须在用户交互后调用（如点击按钮）
  init() {
    if (this.initialized) return
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.initialized = true
      console.log('音效系统已初始化')
    } catch (error) {
      console.warn('无法初始化音效系统:', error)
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioContext || !this.initialized) return
    
    const now = this.audioContext.currentTime
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    oscillator.frequency.value = frequency
    oscillator.type = type
    
    gainNode.gain.setValueAtTime(0.2, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    
    oscillator.start()
    oscillator.stop(now + duration)
  }

  // 移动音效
  move() {
    this.playTone(523.25, 0.05) // C5
  }

  // 旋转音效
  rotate() {
    this.playTone(587.33, 0.05) // D5
  }

  // 下落音效
  drop() {
    this.playTone(659.25, 0.08) // E5
  }

  // 消除行音效
  clearLine() {
    this.playTone(783.99, 0.15, 'triangle') // G5
  }

  // 游戏结束音效
  gameOver() {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    oscillator.frequency.setValueAtTime(440, now)
    oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.5)
    oscillator.type = 'sawtooth'
    
    gainNode.gain.setValueAtTime(0.3, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.8)
    
    oscillator.start()
    oscillator.stop(now + 0.8)
  }
}

export const soundManager = SoundManager.getInstance()
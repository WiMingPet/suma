// lib/sounds.ts

class SoundManager {
  private static instance: SoundManager
  private audioContext: AudioContext | null = null
  private initialized = false
  private bgmOscillator: OscillatorNode | null = null
  private bgmGain: GainNode | null = null
  private bgmInterval: NodeJS.Timeout | null = null
  private isBgmPlaying = false

  static getInstance() {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  // 必须在用户交互后调用
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

  // 恢复 AudioContext（浏览器需要用户交互后允许声音）
  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  // 播放短促音效（通用）
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.2) {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    osc.connect(gain)
    gain.connect(this.audioContext.destination)
    osc.frequency.value = frequency
    osc.type = type
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.start()
    osc.stop(now + duration)
  }

  // 播放和弦（消除行专用）
  private playChord(frequencies: number[], duration: number) {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    frequencies.forEach(freq => {
      const osc = this.audioContext!.createOscillator()
      const gain = this.audioContext!.createGain()
      osc.connect(gain)
      gain.connect(this.audioContext!.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      osc.start()
      osc.stop(now + duration)
    })
  }

  // 扫频（硬降专用）
  private sweep(startFreq: number, endFreq: number, duration: number) {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    osc.connect(gain)
    gain.connect(this.audioContext.destination)
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration)
    osc.type = 'sawtooth'
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.start()
    osc.stop(now + duration)
  }

  // ========== 游戏音效 ==========

  // 开始游戏音效（短促上升音）
  startGame() {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    osc.connect(gain)
    gain.connect(this.audioContext.destination)
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.2)
    osc.type = 'square'
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    osc.start()
    osc.stop(now + 0.25)
    this.resume()
  }

  // 左右移动（清脆滴声）
  move() {
    this.playTone(880, 0.04, 'sine', 0.15)
  }

  // 下键（低沉短促）
  softDrop() {
    this.playTone(440, 0.06, 'triangle', 0.2)
  }

  // 旋转（上升滑音）
  rotate() {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    osc.connect(gain)
    gain.connect(this.audioContext.destination)
    osc.frequency.setValueAtTime(523.25, now)
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08)
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    osc.start()
    osc.stop(now + 0.1)
  }

  // 下落音效（方块着底）
  drop() {
    this.playTone(330, 0.1, 'triangle', 0.3)
  }

  // 硬降（扫频下降）
  hardDrop() {
    this.sweep(800, 200, 0.15)
  }

  // 消除行（经典和弦 + 多行增强）
  clearLine(lines: number = 1) {
    // 基础和弦 C-E-G
    const chord = lines === 1 ? [523.25, 659.25, 783.99] : [523.25, 659.25, 783.99, 1046.5]
    this.playChord(chord, 0.3)
    // 额外低音鼓点
    if (lines >= 2) this.playTone(110, 0.2, 'triangle', 0.3)
    if (lines >= 3) this.playTone(82.41, 0.25, 'sawtooth', 0.25)
    if (lines === 4) this.playTone(65.41, 0.3, 'sawtooth', 0.3)
  }

  // 游戏结束（沉重下降 + 爆炸）
  gameOver() {
    if (!this.audioContext) return
    const now = this.audioContext.currentTime
    // 主旋律下降
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    osc.connect(gain)
    gain.connect(this.audioContext.destination)
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.8)
    osc.type = 'sawtooth'
    gain.gain.setValueAtTime(0.4, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1)
    osc.start()
    osc.stop(now + 1)
    // 低频爆炸
    setTimeout(() => {
      this.playTone(60, 0.5, 'square', 0.5)
    }, 800)
    this.stopBGM()
  }

  // ========== 背景音乐 ==========

  startBGM() {
    if (this.isBgmPlaying || !this.audioContext) return
    this.resume()
    this.isBgmPlaying = true
    // 简单的循环音符序列（经典俄罗斯方块风格）
    const notes = [262, 294, 330, 349, 392, 440, 494, 523] // C4 到 C5
    let index = 0
    const playNote = () => {
      if (!this.isBgmPlaying || !this.audioContext) return
      const freq = notes[index % notes.length]
      const gain = this.audioContext.createGain()
      const osc = this.audioContext.createOscillator()
      osc.connect(gain)
      gain.connect(this.audioContext.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.08, this.audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.15)
      osc.start()
      osc.stop(this.audioContext.currentTime + 0.15)
      index++
      this.bgmInterval = setTimeout(playNote, 250)
    }
    playNote()
  }

  stopBGM() {
    this.isBgmPlaying = false
    if (this.bgmInterval) {
      clearTimeout(this.bgmInterval)
      this.bgmInterval = null
    }
  }
}

export const soundManager = SoundManager.getInstance()
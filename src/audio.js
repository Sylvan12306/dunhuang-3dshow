/**
 * Web Audio API 空间音频模块（增强版）
 * 实现敦煌古乐多层旋律、驼铃音效跟随视角远近自动调节音量
 * 音源坐标匹配洞窟内部位置
 * 多层架构：旋律层 + 低音持续层 + 高音装饰层
 */
import * as THREE from 'three'

let audioContext = null
let audioSources = []
let isPlaying = false
let cameraRef = null
let melodyTimers = []

// 音源位置（匹配洞窟内部坐标）
const AUDIO_SOURCES = [
  {
    name: '序厅驼铃',
    position: { x: 4, y: 0, z: 1.5 },
    type: 'ambient',
    maxDistance: 15,
    volume: 0.25,
  },
  {
    name: '285窟古乐',
    position: { x: 4, y: 0, z: 1.5 },
    type: 'music',
    scale: 'wei',     // 西魏风格：清雅高远
    maxDistance: 12,
    volume: 0.35,
  },
  {
    name: '45窟古乐',
    position: { x: 11, y: 0, z: 1.5 },
    type: 'music',
    scale: 'tang',    // 盛唐风格：华丽丰满
    maxDistance: 12,
    volume: 0.35,
  },
  {
    name: '217窟古乐',
    position: { x: 18, y: 0, z: 1.5 },
    type: 'music',
    scale: 'tang',
    maxDistance: 12,
    volume: 0.35,
  },
  {
    name: '17窟古乐',
    position: { x: 25, y: 0, z: 1.5 },
    type: 'music',
    scale: 'lateTang', // 晚唐风格：沉郁苍凉
    maxDistance: 12,
    volume: 0.35,
  },
  {
    name: '3窟古乐',
    position: { x: 32, y: 0, z: 1.5 },
    type: 'music',
    scale: 'yuan',     // 元代风格：密宗神秘
    maxDistance: 12,
    volume: 0.35,
  },
]

// 五声音阶频率表（C D E G A 不同八度）
const PENTATONIC = {
  low:  [130.81, 146.83, 164.81, 196.00, 220.00],  // C3 D3 E3 G3 A3
  mid:  [261.63, 293.66, 329.63, 392.00, 440.00],  // C4 D4 E4 G4 A4
  high: [523.25, 587.33, 659.25, 783.99, 880.00],  // C5 D5 E5 G5 A5
}

// 敦煌古乐旋律模式（索引对应五声音阶 0-4，负数表示休止）
const MELODIES = {
  wei: [
    // 西魏：清雅高远，多用高音区，节奏舒缓
    { note: 2, octave: 'high', duration: 1.5 },
    { note: 4, octave: 'high', duration: 0.5 },
    { note: 3, octave: 'mid',  duration: 1.0 },
    { note: 2, octave: 'mid',  duration: 1.0 },
    { note: 0, octave: 'mid',  duration: 2.0 },
    { note: -1, octave: 'mid', duration: 0.5 },  // 休止
    { note: 4, octave: 'mid',  duration: 1.0 },
    { note: 3, octave: 'mid',  duration: 1.5 },
    { note: 2, octave: 'high', duration: 1.0 },
    { note: 0, octave: 'mid',  duration: 2.0 },
  ],
  tang: [
    // 盛唐：华丽丰满，中音区为主，节奏明快
    { note: 0, octave: 'mid',  duration: 0.5 },
    { note: 2, octave: 'mid',  duration: 0.5 },
    { note: 4, octave: 'mid',  duration: 0.5 },
    { note: 3, octave: 'mid',  duration: 1.0 },
    { note: 2, octave: 'mid',  duration: 0.5 },
    { note: 0, octave: 'mid',  duration: 1.0 },
    { note: 4, octave: 'high', duration: 0.5 },
    { note: 3, octave: 'high', duration: 1.0 },
    { note: 2, octave: 'mid',  duration: 0.5 },
    { note: 0, octave: 'mid',  duration: 1.5 },
    { note: 2, octave: 'mid',  duration: 0.5 },
    { note: 4, octave: 'mid',  duration: 1.0 },
    { note: 3, octave: 'mid',  duration: 1.5 },
  ],
  lateTang: [
    // 晚唐：沉郁苍凉，低音区为主，节奏缓慢
    { note: 0, octave: 'low',  duration: 2.0 },
    { note: 2, octave: 'low',  duration: 1.0 },
    { note: 3, octave: 'low',  duration: 1.5 },
    { note: 2, octave: 'low',  duration: 0.5 },
    { note: 0, octave: 'mid',  duration: 1.0 },
    { note: -1, octave: 'low', duration: 1.0 },  // 休止
    { note: 3, octave: 'low',  duration: 2.0 },
    { note: 2, octave: 'low',  duration: 1.0 },
    { note: 0, octave: 'low',  duration: 2.0 },
  ],
  yuan: [
    // 元代：密宗神秘，低音持续+高音点缀
    { note: 0, octave: 'low',  duration: 1.5 },
    { note: 4, octave: 'high', duration: 0.5 },
    { note: 3, octave: 'low',  duration: 1.0 },
    { note: 2, octave: 'mid',  duration: 0.5 },
    { note: 0, octave: 'low',  duration: 1.5 },
    { note: -1, octave: 'low', duration: 0.5 },
    { note: 4, octave: 'mid',  duration: 1.0 },
    { note: 3, octave: 'low',  duration: 1.5 },
    { note: 0, octave: 'low',  duration: 2.0 },
  ],
}

/**
 * 初始化空间音频
 * @param {THREE.Camera} camera - 相机（作为监听者位置）
 */
export function initAudio(camera) {
  cameraRef = camera

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  } catch (e) {
    console.warn('[音频] Web Audio API 不支持')
    return
  }

  // 创建程序化音源
  AUDIO_SOURCES.forEach((src) => {
    createProceduralAudio(src)
  })

  console.log('[音频] 空间音频系统初始化完成（' + AUDIO_SOURCES.length + ' 个音源）')
}

/**
 * 创建程序化音频（多层架构：旋律层 + 低音层 + 装饰层）
 */
function createProceduralAudio(source) {
  if (!audioContext) return

  // 主增益节点（控制整体音量）
  const masterGain = audioContext.createGain()
  masterGain.gain.value = 0

  // 空间声像节点
  const pannerNode = audioContext.createPanner()
  pannerNode.panningModel = 'HRTF'
  pannerNode.distanceModel = 'inverse'
  pannerNode.refDistance = 1
  pannerNode.maxDistance = source.maxDistance
  pannerNode.rolloffFactor = 1.5
  pannerNode.positionX.value = source.position.x
  pannerNode.positionY.value = source.position.y
  pannerNode.positionZ.value = source.position.z

  // 连接：主增益 -> 空间声像 -> 输出
  masterGain.connect(pannerNode)
  pannerNode.connect(audioContext.destination)

  if (source.type === 'ambient') {
    // 驼铃环境音：有节奏的铃声 + 低频风声
    createAmbientSound(masterGain)
  } else {
    // 古乐：多层旋律
    createMusicSound(masterGain, source.scale || 'tang')
  }

  audioSources.push({
    name: source.name,
    source: source,
    gainNode: masterGain,
    pannerNode: pannerNode,
  })
}

/**
 * 创建驼铃环境音（有节奏的铃声 + 低频风声）
 */
function createAmbientSound(masterGain) {
  // 低频风声持续音
  const windOsc = audioContext.createOscillator()
  const windGain = audioContext.createGain()
  windOsc.type = 'sine'
  windOsc.frequency.value = 80  // 低频风声
  windGain.gain.value = 0.15
  windOsc.connect(windGain)
  windGain.connect(masterGain)
  windOsc.start()

  // 驼铃声（有节奏的脉冲）
  const bellOsc = audioContext.createOscillator()
  const bellGain = audioContext.createGain()
  bellOsc.type = 'triangle'
  bellOsc.frequency.value = 660  // 驼铃高频
  bellGain.gain.value = 0
  bellOsc.connect(bellGain)
  bellGain.connect(masterGain)
  bellOsc.start()

  // 驼铃节奏：每 3 秒响一次，模拟驼队行进
  const bellTimer = setInterval(() => {
    if (!isPlaying) return
    const now = audioContext.currentTime
    // 驼铃包络：快速起音，缓慢衰减
    bellGain.gain.setValueAtTime(0, now)
    bellGain.gain.linearRampToValueAtTime(0.3, now + 0.02)
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5)
  }, 3000)
  melodyTimers.push(bellTimer)
}

/**
 * 创建古乐多层旋律（旋律层 + 低音层 + 装饰层）
 */
function createMusicSound(masterGain, scaleType) {
  const melody = MELODIES[scaleType] || MELODIES.tang
  let melodyIndex = 0

  // --- 旋律层（主旋律，triangle 波温暖音色）---
  const melodyOsc = audioContext.createOscillator()
  const melodyGain = audioContext.createGain()
  melodyOsc.type = 'triangle'
  melodyGain.gain.value = 0
  melodyOsc.connect(melodyGain)
  melodyGain.connect(masterGain)
  melodyOsc.start()

  // --- 低音层（持续低音，sine 波深沉）---
  const bassOsc = audioContext.createOscillator()
  const bassGain = audioContext.createGain()
  bassOsc.type = 'sine'
  bassGain.gain.value = 0.08  // 低音音量较低
  bassOsc.connect(bassGain)
  bassGain.connect(masterGain)
  bassOsc.start()

  // --- 装饰层（高音点缀，sine 波清脆）---
  const decorOsc = audioContext.createOscillator()
  const decorGain = audioContext.createGain()
  decorOsc.type = 'sine'
  decorGain.gain.value = 0
  decorOsc.connect(decorGain)
  decorGain.connect(masterGain)
  decorOsc.start()

  // 旋律播放调度
  function playNextNote() {
    if (!isPlaying || !audioContext) return

    const note = melody[melodyIndex % melody.length]
    const now = audioContext.currentTime
    const freq = PENTATONIC[note.octave][note.note]

    if (note.note >= 0) {
      // 旋律层：播放音符（带 ADSR 包络）
      melodyOsc.frequency.setValueAtTime(freq, now)
      melodyGain.gain.setValueAtTime(0, now)
      melodyGain.gain.linearRampToValueAtTime(0.25, now + 0.05)  // 起音
      melodyGain.gain.exponentialRampToValueAtTime(0.15, now + note.duration * 0.5)  // 衰减
      melodyGain.gain.exponentialRampToValueAtTime(0.001, now + note.duration * 0.9)  // 释放

      // 低音层：每 4 个音符换一次低音
      if (melodyIndex % 4 === 0) {
        const bassFreq = PENTATONIC.low[note.note % 5]
        bassOsc.frequency.setValueAtTime(bassFreq, now)
        bassGain.gain.linearRampToValueAtTime(0.1, now + 0.3)
      }

      // 装饰层：每 3 个音符添加高音点缀
      if (melodyIndex % 3 === 0 && note.octave !== 'high') {
        const decorFreq = PENTATONIC.high[note.note % 5]
        decorOsc.frequency.setValueAtTime(decorFreq, now + note.duration * 0.3)
        decorGain.gain.setValueAtTime(0, now + note.duration * 0.3)
        decorGain.gain.linearRampToValueAtTime(0.08, now + note.duration * 0.3 + 0.03)
        decorGain.gain.exponentialRampToValueAtTime(0.001, now + note.duration * 0.8)
      }
    } else {
      // 休止符
      melodyGain.gain.setValueAtTime(0, now)
    }

    melodyIndex++
    // 调度下一个音符
    const timer = setTimeout(playNextNote, note.duration * 1000)
    melodyTimers.push(timer)
  }

  // 启动旋律播放
  const startTimer = setTimeout(playNextNote, 500)
  melodyTimers.push(startTimer)
}

/**
 * 更新音频监听者位置（跟随相机）
 */
export function updateAudioListener() {
  if (!audioContext || !cameraRef) return

  // 更新监听者位置和朝向
  if (audioContext.listener.positionX) {
    audioContext.listener.positionX.value = cameraRef.position.x
    audioContext.listener.positionY.value = cameraRef.position.y
    audioContext.listener.positionZ.value = cameraRef.position.z
  }

  // 根据相机到音源的距离自动调节音量
  audioSources.forEach((audio) => {
    if (!isPlaying) return

    const dx = cameraRef.position.x - audio.source.position.x
    const dy = cameraRef.position.y - audio.source.position.y
    const dz = cameraRef.position.z - audio.source.position.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    const maxDist = audio.source.maxDistance
    let volume = 0
    if (distance < maxDist) {
      volume = (1 - distance / maxDist) * audio.source.volume
    }

    // 平滑过渡音量
    const currentVol = audio.gainNode.gain.value
    const newVol = currentVol + (volume - currentVol) * 0.1
    audio.gainNode.gain.setValueAtTime(newVol, audioContext.currentTime)
  })
}

/**
 * 切换音频播放
 */
export function toggleAudio() {
  if (!audioContext) return false

  if (audioContext.state === 'suspended') {
    audioContext.resume()
    isPlaying = true
    console.log('[音频] 敦煌古乐开启')
  } else if (isPlaying) {
    audioSources.forEach((audio) => {
      audio.gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    })
    isPlaying = false
    console.log('[音频] 敦煌古乐暂停')
  } else {
    isPlaying = true
    console.log('[音频] 敦煌古乐恢复')
  }

  return isPlaying
}

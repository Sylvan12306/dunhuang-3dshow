/**
 * MediaPipe 手部追踪手势交互模块（增强版）
 * 整合手部识别与 Three.js 场景
 * 实现隔空旋转场景、隔空点击展品、食指悬停高亮
 * 新增：手势指引弹窗、金色高亮动效提示可交互点位
 * 新增：手势状态实时显示、交互视觉反馈（旋转方向/点击闪光/指向准星）
 * 适配线下大屏无鼠标展示场景
 */
import * as THREE from 'three'

let camera = null
let domElement = null
let controls = null
let gestureActive = false
let hands = null
let videoElement = null
let canvasElement = null
let canvasCtx = null

// 手势状态
let lastHandPosition = null
let isPinching = false
let pinchStartTime = 0
let currentGestureType = 'none'  // 当前手势类型

// 金色高亮动效（手势模式下提示可交互点位）
let highlightObjects = []
let highlightRing = null
let highlightAnimationId = null

// 手势状态指示器UI元素
let gestureStatusElement = null
let gestureFeedbackLayer = null  // 交互反馈层（覆盖全屏的透明层）

let scene = null

/**
 * 初始化 MediaPipe 手势交互
 * @param {THREE.Camera} cam - 相机
 * @param {HTMLElement} dom - 渲染 DOM 元素
 * @param {Object} ctrl - OrbitControls 控制器
 * @param {THREE.Scene} scn - 场景对象（用于添加高亮动效）
 */
export function initGesture(cam, dom, ctrl, scn) {
  camera = cam
  domElement = dom
  controls = ctrl
  scene = scn

  console.log('[手势] MediaPipe 手势交互模块初始化完成')
  console.log('[手势] 点击顶部"手势"按钮查看指引并启用手势识别')
}

/**
 * 切换手势交互
 */
export async function toggleGesture() {
  if (gestureActive) {
    stopGesture()
    return false
  } else {
    await startGesture()
    return gestureActive
  }
}

/**
 * 启动手势识别
 */
async function startGesture() {
  try {
    // 动态加载 MediaPipe Hands
    // 使用 CDN 加载 MediaPipe 库
    await loadMediaPipeScript()

    // 创建视频元素（摄像头画面）
    videoElement = document.createElement('video')
    videoElement.style.cssText =
      'position:fixed;bottom:20px;right:20px;width:240px;height:180px;' +
      'border:2px solid #c4a668;border-radius:8px;z-index:100;object-fit:cover;'
    document.body.appendChild(videoElement)

    // 创建手部关键点画布
    canvasElement = document.createElement('canvas')
    canvasElement.width = 240
    canvasElement.height = 180
    canvasElement.style.cssText =
      'position:fixed;bottom:20px;right:20px;width:240px;height:180px;' +
      'z-index:101;pointer-events:none;'
    document.body.appendChild(canvasElement)
    canvasCtx = canvasElement.getContext('2d')

    // 创建手势状态指示器（显示在摄像头预览上方）
    gestureStatusElement = document.createElement('div')
    gestureStatusElement.style.cssText =
      'position:fixed;bottom:205px;right:20px;width:240px;padding:8px 12px;' +
      'background:rgba(26,20,16,0.9);border:1px solid #5a4a32;border-radius:6px;' +
      'color:#c4a668;font-size:13px;text-align:center;z-index:101;' +
      'letter-spacing:1px;transition:all 0.3s;'
    gestureStatusElement.textContent = '等待手势...'
    document.body.appendChild(gestureStatusElement)

    // 创建交互反馈层（全屏透明层，用于显示旋转方向/点击闪光/指向准星）
    gestureFeedbackLayer = document.createElement('div')
    gestureFeedbackLayer.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:99;'
    document.body.appendChild(gestureFeedbackLayer)

    // 获取摄像头流
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' }
    })
    videoElement.srcObject = stream
    await videoElement.play()

    // 初始化 MediaPipe Hands
    hands = new window.Hands({
      locateFile: (file) => {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file
      }
    })

    hands.setOptions({
      maxNumHands: 1,           // 最多检测 1 只手
      modelComplexity: 1,       // 模型复杂度
      minDetectionConfidence: 0.7,  // 最小检测置信度
      minTrackingConfidence: 0.5,   // 最小追踪置信度
    })

    hands.onResults(onHandResults)

    // 启动摄像头画面处理循环
    processVideoFrame()

    gestureActive = true
    // 启用金色高亮动效提示可交互点位
    addHighlightToInteractables()
    console.log('[手势] 手势识别已启动')
  } catch (e) {
    console.error('[手势] 启动失败: ' + e.message)
    alert('手势识别启动失败: ' + e.message + '\n请确保已连接摄像头并授权访问')
  }
}

/**
 * 停止手势识别
 */
function stopGesture() {
  gestureActive = false

  if (videoElement) {
    const stream = videoElement.srcObject
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    videoElement.remove()
    videoElement = null
  }

  if (canvasElement) {
    canvasElement.remove()
    canvasElement = null
  }

  // 移除手势状态指示器
  if (gestureStatusElement) {
    gestureStatusElement.remove()
    gestureStatusElement = null
  }

  // 移除交互反馈层
  if (gestureFeedbackLayer) {
    gestureFeedbackLayer.remove()
    gestureFeedbackLayer = null
  }

  if (hands) {
    hands.close()
    hands = null
  }

  // 移除金色高亮动效
  removeHighlightFromInteractables()

  console.log('[手势] 手势识别已停止')
}

/**
 * 为可交互展品添加金色高亮动效
 * 在壁画、彩塑等展品周围添加脉冲金色光环，提示可交互点位
 */
function addHighlightToInteractables() {
  if (!scene) return

  removeHighlightFromInteractables()

  // 遍历场景寻找可交互展品（壁画、彩塑、主佛等）
  scene.traverse((child) => {
    if (child.isMesh && child.name) {
      const name = child.name
      // 匹配可交互展品名称
      if (name.includes('壁画') || name.includes('彩塑') || name.includes('主佛') ||
          name.includes('经变画') || name.includes('飞天') || name.includes('观音') ||
          name.includes('藻井') || name.includes('迦叶') || name.includes('阿难') ||
          name.includes('菩萨') || name.includes('天王') || name.includes('力士') ||
          name.includes('供养人') || name.includes('藏经')) {

        // 创建金色光环
        const ringGeometry = new THREE.RingGeometry(0.6, 0.8, 32)
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0xc4a668,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.position.copy(child.position)
        ring.position.z += 0.1
        ring.rotation.z = 0
        ring.name = '手势高亮_' + name
        ring.userData.targetMesh = child
        ring.userData.baseScale = 1.0
        ring.userData.phase = Math.random() * Math.PI * 2

        scene.add(ring)
        highlightObjects.push(ring)
      }
    }
  })

  // 启动脉冲动画
  if (highlightAnimationId) cancelAnimationFrame(highlightAnimationId)
  animateHighlight()

  console.log('[手势] 已为 ' + highlightObjects.length + ' 个展品添加金色高亮提示')
}

/**
 * 移除所有金色高亮动效
 */
function removeHighlightFromInteractables() {
  if (highlightAnimationId) {
    cancelAnimationFrame(highlightAnimationId)
    highlightAnimationId = null
  }

  highlightObjects.forEach((ring) => {
    if (ring.parent) {
      ring.parent.remove(ring)
    }
    ring.geometry.dispose()
    ring.material.dispose()
  })
  highlightObjects = []
}

/**
 * 金色高亮脉冲动效
 */
function animateHighlight() {
  const elapsed = performance.now() * 0.001

  highlightObjects.forEach((ring) => {
    if (!ring.parent) return

    // 脉冲缩放
    const pulse = 1.0 + Math.sin(elapsed * 2 + ring.userData.phase) * 0.15
    ring.scale.set(pulse, pulse, pulse)

    // 透明度呼吸
    ring.material.opacity = 0.4 + Math.sin(elapsed * 2 + ring.userData.phase) * 0.3

    // 让光环始终面向相机
    if (camera) {
      ring.lookAt(camera.position)
    }
  })

  highlightAnimationId = requestAnimationFrame(animateHighlight)
}

/**
 * 处理视频帧
 */
async function processVideoFrame() {
  if (!gestureActive || !videoElement || !hands) return

  try {
    await hands.send({ image: videoElement })
  } catch (e) {
    console.warn('[手势] 处理帧失败: ' + e.message)
  }

  requestAnimationFrame(processVideoFrame)
}

/**
 * 手部识别结果处理
 */
function onHandResults(results) {
  // 清除画布
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height)

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    lastHandPosition = null
    // 更新状态：未检测到手
    updateGestureStatus('none', '等待手势...')
    // 清除反馈层
    clearFeedbackLayer()
    return
  }

  // 绘制手部关键点
  const landmarks = results.multiHandLandmarks[0]
  drawHandLandmarks(landmarks)

  // 识别手势
  const gesture = recognizeGesture(landmarks)
  handleGesture(gesture, landmarks)

  // 更新手势状态显示
  const gestureNames = {
    'open': '张开手掌 - 旋转视角',
    'pinch': '捏合手势 - 点击展品',
    'point': '食指指向 - 悬停高亮',
    'fist': '握拳 - 停止操作',
  }
  updateGestureStatus(gesture, gestureNames[gesture] || gesture)
}

/**
 * 更新手势状态指示器
 * @param {string} gestureType - 手势类型
 * @param {string} displayText - 显示文字
 */
function updateGestureStatus(gestureType, displayText) {
  if (!gestureStatusElement) return

  currentGestureType = gestureType
  gestureStatusElement.textContent = displayText

  // 根据手势类型改变指示器颜色
  const statusColors = {
    'open':   { border: '#5B8C6A', bg: 'rgba(91,140,106,0.2)', text: '#7BCC8A' },  // 石绿
    'pinch':  { border: '#C44536', bg: 'rgba(196,69,54,0.2)',  text: '#E87060' },  // 朱砂
    'point':  { border: '#C4A668', bg: 'rgba(196,166,104,0.2)',text: '#FFE0A0' }, // 土黄
    'fist':   { border: '#8B5A3C', bg: 'rgba(139,90,60,0.2)',  text: '#C4A668' },  // 赭石
    'none':   { border: '#5a4a32', bg: 'rgba(26,20,16,0.9)',   text: '#8a7a5a' },  // 默认
  }
  const colors = statusColors[gestureType] || statusColors['none']
  gestureStatusElement.style.borderColor = colors.border
  gestureStatusElement.style.background = colors.bg
  gestureStatusElement.style.color = colors.text
}

/**
 * 清除反馈层内容
 */
function clearFeedbackLayer() {
  if (!gestureFeedbackLayer) return
  // 保留准星元素（如果有），清除其他反馈
  const feedbacks = gestureFeedbackLayer.querySelectorAll('.gesture-feedback')
  feedbacks.forEach(el => el.remove())
}

/**
 * 在反馈层创建临时反馈元素（自动消失）
 * @param {number} x - 屏幕X坐标
 * @param {number} y - 屏幕Y坐标
 * @param {string} type - 反馈类型：'click' | 'rotate-left' | 'rotate-right' | 'crosshair'
 * @param {number} duration - 持续时间（毫秒）
 */
function createFeedback(x, y, type, duration = 800) {
  if (!gestureFeedbackLayer) return

  const el = document.createElement('div')
  el.className = 'gesture-feedback'

  if (type === 'click') {
    // 点击闪光：金色扩散圆圈
    el.style.cssText =
      'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
      'width:20px;height:20px;margin:-10px 0 0 -10px;' +
      'border:3px solid #c4a668;border-radius:50%;' +
      'animation:gestureClickFlash ' + duration + 'ms ease-out forwards;'
  } else if (type === 'rotate-left' || type === 'rotate-right') {
    // 旋转方向指示：屏幕边缘箭头
    const isLeft = type === 'rotate-left'
    el.style.cssText =
      'position:absolute;' + (isLeft ? 'left:40px;' : 'right:40px;') + 'top:50%;' +
      'margin-top:-20px;width:40px;height:40px;' +
      'border:3px solid #5B8C6A;border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;' +
      'font-size:24px;color:#5B8C6A;' +
      'animation:gesturePulse ' + duration + 'ms ease-out forwards;'
    el.textContent = isLeft ? '\u2190' : '\u2192'
  } else if (type === 'crosshair') {
    // 指向准星：十字标记
    el.style.cssText =
      'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
      'width:30px;height:30px;margin:-15px 0 0 -15px;' +
      'border:2px solid #c4a668;border-radius:50%;' +
      'box-shadow:0 0 10px rgba(196,166,104,0.6);' +
      'animation:gestureCrosshair ' + duration + 'ms ease-out forwards;'
  }

  gestureFeedbackLayer.appendChild(el)

  // 自动移除
  setTimeout(() => {
    if (el.parentNode) el.remove()
  }, duration)
}

/**
 * 绘制手部关键点
 */
function drawHandLandmarks(landmarks) {
  const w = canvasElement.width
  const h = canvasElement.height

  // 绘制连接线
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],      // 拇指
    [0, 5], [5, 6], [6, 7], [7, 8],      // 食指
    [5, 9], [9, 10], [10, 11], [11, 12],  // 中指
    [9, 13], [13, 14], [14, 15], [15, 16],// 无名指
    [13, 17], [17, 18], [18, 19], [19, 20],// 小指
    [0, 17]                               // 手掌
  ]

  canvasCtx.strokeStyle = '#c4a668'
  canvasCtx.lineWidth = 2
  connections.forEach(([a, b]) => {
    canvasCtx.beginPath()
    canvasCtx.moveTo(landmarks[a].x * w, landmarks[a].y * h)
    canvasCtx.lineTo(landmarks[b].x * w, landmarks[b].y * h)
    canvasCtx.stroke()
  })

  // 绘制关键点
  landmarks.forEach((lm) => {
    canvasCtx.fillStyle = '#ffe0a0'
    canvasCtx.beginPath()
    canvasCtx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2)
    canvasCtx.fill()
  })
}

/**
 * 识别手势
 * @returns {string} 手势类型: 'open' | 'pinch' | 'point' | 'fist'
 */
function recognizeGesture(landmarks) {
  // 拇指尖（4）和食指尖（8）之间的距离
  const thumbTip = landmarks[4]
  const indexTip = landmarks[8]
  const dx = thumbTip.x - indexTip.x
  const dy = thumbTip.y - indexTip.y
  const pinchDistance = Math.sqrt(dx * dx + dy * dy)

  // 食指尖（8）和食指根（5）的距离（判断食指是否伸直）
  const indexBase = landmarks[5]
  const indexLength = Math.sqrt(
    Math.pow(indexTip.x - indexBase.x, 2) +
    Math.pow(indexTip.y - indexBase.y, 2)
  )

  // 中指尖（12）和中指根（9）的距离
  const midTip = landmarks[12]
  const midBase = landmarks[9]
  const midLength = Math.sqrt(
    Math.pow(midTip.x - midBase.x, 2) +
    Math.pow(midTip.y - midBase.y, 2)
  )

  // 捏合手势：拇指和食指距离很近
  if (pinchDistance < 0.05) {
    return 'pinch'
  }

  // 指向手势：食指伸直，中指弯曲
  if (indexLength > 0.15 && midLength < 0.1) {
    return 'point'
  }

  // 张开手势：食指和中指都伸直
  if (indexLength > 0.15 && midLength > 0.15) {
    return 'open'
  }

  // 握拳：所有手指弯曲
  return 'fist'
}

/**
 * 处理手势交互
 */
function handleGesture(gesture, landmarks) {
  // 使用食指尖（8）或手掌中心（0）作为位置参考
  const handCenter = landmarks[9]  // 中指根部，较稳定

  switch (gesture) {
    case 'open':
      // 张开手：旋转场景
      handleRotate(handCenter)
      break

    case 'pinch':
      // 捏合：点击展品
      handlePinch(handCenter)
      break

    case 'point':
      // 指向：悬停高亮
      handlePoint(handCenter)
      break

    case 'fist':
      // 握拳：停止操作
      lastHandPosition = null
      break
  }
}

/**
 * 旋转场景（隔空旋转）
 * 手部水平移动时，在屏幕边缘显示旋转方向箭头反馈
 */
function handleRotate(handCenter) {
  if (lastHandPosition) {
    // 计算手部水平移动量
    const deltaX = handCenter.x - lastHandPosition.x
    const deltaY = handCenter.y - lastHandPosition.y

    // 旋转相机（通过 OrbitControls 的 azimuth 角度）
    if (controls) {
      // 将手部移动映射到相机旋转
      const rotateSpeed = 5
      const azimuthDelta = deltaX * rotateSpeed
      const polarDelta = deltaY * rotateSpeed

      // 使用球面坐标旋转
      const offset = new THREE.Vector3().subVectors(controls.object.position, controls.target)
      const spherical = new THREE.Spherical().setFromVector3(offset)

      spherical.theta -= azimuthDelta
      spherical.phi -= polarDelta
      spherical.phi = Math.max(controls.minPolarAngle, Math.min(controls.maxPolarAngle, spherical.phi))

      offset.setFromSpherical(spherical)
      controls.object.position.copy(controls.target).add(offset)
      controls.object.lookAt(controls.target)

      // 旋转方向视觉反馈（仅在移动幅度较大时显示，避免反馈过于频繁）
      if (Math.abs(deltaX) > 0.008) {
        // 手右移 -> 场景左旋（屏幕左箭头）；手左移 -> 场景右旋（屏幕右箭头）
        const direction = deltaX > 0 ? 'rotate-left' : 'rotate-right'
        createFeedback(0, 0, direction, 600)
      }
    }
  }

  lastHandPosition = { x: handCenter.x, y: handCenter.y }
}

/**
 * 捏合点击（隔空点击展品）
 * 捏合时在屏幕对应位置显示金色扩散闪光反馈
 */
function handlePinch(handCenter) {
  if (!isPinching) {
    isPinching = true
    pinchStartTime = performance.now()

    // 将手部位置映射到屏幕坐标
    const screenX = handCenter.x * window.innerWidth
    const screenY = handCenter.y * window.innerHeight

    // 在捏合位置显示金色点击闪光反馈
    createFeedback(screenX, screenY, 'click', 800)

    // 模拟点击事件
    const clickEvent = new MouseEvent('click', {
      clientX: screenX,
      clientY: screenY,
      bubbles: true
    })
    domElement.dispatchEvent(clickEvent)

    console.log('[手势] 隔空点击: (' + screenX.toFixed(0) + ', ' + screenY.toFixed(0) + ')')
  }
}

/**
 * 指向悬停
 * 食指指向时在屏幕对应位置显示土黄色准星反馈
 */
function handlePoint(handCenter) {
  const screenX = handCenter.x * window.innerWidth
  const screenY = handCenter.y * window.innerHeight

  // 在指向位置显示准星反馈（清除上一次的准星后重新创建，实现跟随效果）
  clearFeedbackLayer()
  createFeedback(screenX, screenY, 'crosshair', 1200)

  // 模拟鼠标移动事件
  const moveEvent = new MouseEvent('pointermove', {
    clientX: screenX,
    clientY: screenY,
    bubbles: true
  })
  domElement.dispatchEvent(moveEvent)
}

// 重置捏合状态
setInterval(() => {
  if (isPinching && performance.now() - pinchStartTime > 500) {
    isPinching = false
  }
}, 100)

/**
 * 动态加载 MediaPipe 脚本
 */
function loadMediaPipeScript() {
  return new Promise((resolve, reject) => {
    if (window.Hands) {
      resolve()
      return
    }

    // 加载 MediaPipe Hands 库
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      console.log('[手势] MediaPipe Hands 库加载完成')
      resolve()
    }
    script.onerror = () => {
      reject(new Error('MediaPipe 库加载失败，请检查网络连接'))
    }
    document.head.appendChild(script)
  })
}

/**
 * WebXR VR 模式适配模块
 * 实现 VR 头显视角同步、洞窟沉浸式漫游交互
 * 适配 Blender 1:1 真实洞窟尺寸
 */
import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'

let renderer = null
let camera = null
let scene = null
let controller1 = null
let controller2 = null
let isVREnabled = false

/**
 * 初始化 VR 模式
 * @param {THREE.WebGLRenderer} rdr - 渲染器
 * @param {THREE.Camera} cam - 相机
 * @param {THREE.Scene} scn - 场景
 */
export function initVR(rdr, cam, scn) {
  renderer = rdr
  camera = cam
  scene = scn

  // 启用 WebXR 支持
  renderer.xr.enabled = true

  // 创建 VR 按钮（自动检测 VR 设备）
  // VRButton.createButton() 会返回一个 DOM 按钮
  // 如果浏览器不支持 WebXR，按钮会显示提示
  try {
    const vrButton = VRButton.createButton(renderer)
    vrButton.style.display = 'none'  // 默认隐藏，通过顶部按钮控制
    document.body.appendChild(vrButton)

    // 监听 VR 会话状态
    renderer.xr.addEventListener('sessionstart', onVRSessionStart)
    renderer.xr.addEventListener('sessionend', onVRSessionEnd)

    console.log('[VR] WebXR VR 模式初始化完成')
  } catch (e) {
    console.warn('[VR] WebXR 不可用: ' + e.message)
  }

  // 创建 VR 控制器
  setupVRControllers()
}

/**
 * 设置 VR 控制器
 */
function setupVRControllers() {
  // 控制器 1（左手）
  controller1 = renderer.xr.getController(0)
  controller1.name = 'VR控制器_左'
  scene.add(controller1)

  // 控制器 2（右手）
  controller2 = renderer.xr.getController(1)
  controller2.name = 'VR控制器_右'
  scene.add(controller2)

  // 控制器射线（用于拾取）
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -5)
  ])
  const rayMaterial = new THREE.LineBasicMaterial({
    color: 0xc4a668,
    transparent: true,
    opacity: 0.5
  })

  const ray1 = new THREE.Line(rayGeometry, rayMaterial)
  controller1.add(ray1)

  const ray2 = new THREE.Line(rayGeometry, rayMaterial)
  controller2.add(ray2)

  // 控制器按键事件
  controller1.addEventListener('selectstart', onSelectStart)
  controller1.addEventListener('selectend', onSelectEnd)
  controller2.addEventListener('selectstart', onSelectStart)
  controller2.addEventListener('selectend', onSelectEnd)
}

/**
 * VR 会话开始
 */
function onVRSessionStart() {
  isVREnabled = true
  console.log('[VR] VR 会话已开始 - 沉浸式洞窟漫游')

  // VR 模式下调整相机高度（人眼高度 1.6m）
  camera.position.set(camera.position.x, camera.position.y, 1.6)

  // VR 模式下禁用 OrbitControls（使用头部追踪）
  const controls = getControlsRef()
  if (controls) controls.enabled = false
}

/**
 * VR 会话结束
 */
function onVRSessionEnd() {
  isVREnabled = false
  console.log('[VR] VR 会话已结束')

  // 恢复 OrbitControls
  const controls = getControlsRef()
  if (controls) controls.enabled = true
}

// 控制器引用（从 controls.js 获取）
let controlsRef = null
export function setControlsRef(ref) {
  controlsRef = ref
}

function getControlsRef() {
  return controlsRef
}

/**
 * VR 控制器选择事件（扳机按下）
 */
function onSelectStart(event) {
  const controller = event.target
  // 发射射线拾取
  const raycaster = new THREE.Raycaster()
  raycaster.setFromXRController(controller)

  // 检测相交对象（复用 raycaster 模块逻辑）
  console.log('[VR] 控制器触发: ' + controller.name)
}

function onSelectEnd(event) {
  // 选择结束
}

/**
 * 切换 VR 模式
 */
export function toggleVR() {
  if (!renderer || !renderer.xr) {
    console.warn('[VR] WebXR 不可用')
    alert('VR 模式需要支持 WebXR 的浏览器和 VR 头显设备')
    return false
  }

  // 查找 VR 按钮并触发点击
  const vrButton = document.querySelector('#VRButton')
  if (vrButton) {
    vrButton.click()
    return true
  }

  console.warn('[VR] VR 按钮未找到')
  return false
}

/**
 * VR 渲染循环（替代普通渲染循环）
 * 在 VR 模式下使用 renderer.setAnimationLoop
 */
export function setVRAnimationLoop(callback) {
  if (!renderer) return

  renderer.setAnimationLoop((timestamp, frame) => {
    callback(timestamp, frame)
  })
}

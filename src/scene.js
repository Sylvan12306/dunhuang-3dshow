/**
 * 场景搭建模块 - Scene / Camera / Renderer 初始化
 * 适配洞窟大空间视野，包含窗口自适应、抗锯齿、画布适配
 */
import * as THREE from 'three'

// 全局场景对象
let scene = null
let camera = null
let renderer = null
let clock = null

/**
 * 初始化 Three.js 基础场景
 * @returns {Object} { scene, camera, renderer, clock }
 */
export function initScene() {
  // --- Scene 场景 ---
  scene = new THREE.Scene()
  // 背景色：深赭石色（融入敦煌矿物色彩体系，营造石窟暗光环境）
  scene.background = new THREE.Color(0x2a1e14)
  // 雾效：增强洞窟空间纵深感，暖色调雾
  scene.fog = new THREE.FogExp2(0x2a1e14, 0.012)

  // --- Camera 相机 ---
  // 透视相机，FOV 60 度适配洞窟大空间视野
  camera = new THREE.PerspectiveCamera(
    60,                                    // 视场角
    window.innerWidth / window.innerHeight, // 宽高比
    0.1,                                   // 近裁剪面
    2000                                   // 远裁剪面（洞窟纵深大）
  )
  // 初始相机位置：入口处，人眼高度 1.6m
  camera.position.set(2, 0, 1.6)
  camera.lookAt(20, 0, 1.6)

  // --- Renderer 渲染器 ---
  renderer = new THREE.WebGLRenderer({
    antialias: true,           // 抗锯齿
    alpha: false,               // 不透明背景
    powerPreference: 'high-performance', // 高性能模式
    stencil: false,             // 关闭模板缓冲（节省内存）
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // 限制像素比，兼顾性能
  renderer.outputColorSpace = THREE.SRGBColorSpace  // 正确的色彩空间
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 电影级色调映射
  renderer.toneMappingExposure = 1.0                    // 曝光控制（暖调洞窟氛围）
  renderer.shadowMap.enabled = true                     // 启用阴影
  renderer.shadowMap.type = THREE.PCFSoftShadowMap      // 柔和阴影

  // 将 canvas 添加到 DOM
  const app = document.getElementById('app')
  app.appendChild(renderer.domElement)

  // --- Clock 时钟 ---
  clock = new THREE.Clock()

  console.log('[场景] Scene/Camera/Renderer 初始化完成')
  return { scene, camera, renderer, clock }
}

/**
 * 获取场景对象
 */
export function getScene() { return scene }

/**
 * 获取相机
 */
export function getCamera() { return camera }

/**
 * 获取渲染器
 */
export function getRenderer() { return renderer }

/**
 * 窗口大小变化自适应
 */
export function onWindowResize() {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

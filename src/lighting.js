/**
 * 三层光照系统模块
 * AmbientLight 环境光 + DirectionalLight 平行光 + HemisphereLight 半球光
 * 适配敦煌洞窟暖黄柔光参数，实现柔和阴影、避免壁画反光高光
 */
import * as THREE from 'three'

// 光照参数常量（3000K 暖黄光）
const WARM_COLOR = 0xffe4b5   // 暖黄色温
const WARM_INTENSITY = 0.6    // 基础亮度

// 全局灯光引用
let lights = {}

/**
 * 配置三层光照系统
 * @param {THREE.Scene} scene - Three.js 场景
 */
export function setupLighting(scene) {
  // --- 第一层：AmbientLight 环境光 ---
  // 全局均匀填充光，避免暗部死黑，模拟洞窟漫反射环境
  const ambient = new THREE.AmbientLight(WARM_COLOR, 0.35)
  scene.add(ambient)

  // --- 第二层：HemisphereLight 半球光 ---
  // 上方暖黄光 + 下方地面反射灰棕光，模拟洞窟顶部光源 + 地面漫反射
  const hemi = new THREE.HemisphereLight(
    0xffe4b5,  // 天空色：暖黄
    0x4a3828,  // 地面色：灰棕（地面反射）
    0.4        // 强度
  )
  hemi.position.set(0, 10, 0)
  scene.add(hemi)

  // --- 第三层：DirectionalLight 平行光 ---
  // 主光源方向，模拟洞窟入口自然光 + 顶部射灯
  // 多盏平行光模拟不同方向的射灯
  const dirLights = []

  // 主平行光：模拟入口方向自然光
  const dirMain = new THREE.DirectionalLight(WARM_COLOR, 0.5)
  dirMain.position.set(10, 8, 5)
  dirMain.castShadow = true
  dirMain.shadow.mapSize.width = 2048   // 阴影贴图分辨率
  dirMain.shadow.mapSize.height = 2048
  dirMain.shadow.camera.near = 0.5
  dirMain.shadow.camera.far = 50
  dirMain.shadow.camera.left = -30
  dirMain.shadow.camera.right = 30
  dirMain.shadow.camera.top = 30
  dirMain.shadow.camera.bottom = -30
  dirMain.shadow.bias = -0.0005  // 阴影偏移，避免阴影伪影
  scene.add(dirMain)
  dirLights.push(dirMain)

  // 辅助平行光 1：模拟洞窟顶部射灯（暖黄柔光）
  const dirTop = new THREE.DirectionalLight(0xffd699, 0.3)
  dirTop.position.set(20, 12, 0)
  dirTop.castShadow = false  // 辅助光不投射阴影，避免多重阴影
  scene.add(dirTop)
  dirLights.push(dirTop)

  // 辅助平行光 2：模拟经变画局部补光（120lux 重点画面）
  const dirSpot = new THREE.DirectionalLight(0xffe0b0, 0.25)
  dirSpot.position.set(25, 5, 3)
  dirSpot.castShadow = false
  scene.add(dirSpot)
  dirLights.push(dirSpot)

  // --- 点光源：模拟彩塑双侧 45 度侧柔光 ---
  // 在洞窟佛龛位置添加点光源，勾勒衣纹面部
  const pointLights = []
  const cavePositions = [
    { x: 11, y: 0, z: 2.5 },   // 285 窟
    { x: 18, y: 0, z: 2.5 },   // 45 窟
    { x: 25, y: 0, z: 2.5 },   // 217 窟
    { x: 32, y: 0, z: 2.5 },   // 17 窟
    { x: 39, y: 0, z: 2.5 },   // 3 窟
  ]

  cavePositions.forEach((pos, i) => {
    // 左侧 45 度柔光
    const pl1 = new THREE.PointLight(0xffe0b0, 0.3, 8, 2)
    pl1.position.set(pos.x + 1, pos.y - 1.5, pos.z)
    scene.add(pl1)
    pointLights.push(pl1)

    // 右侧 45 度柔光
    const pl2 = new THREE.PointLight(0xffe0b0, 0.3, 8, 2)
    pl2.position.set(pos.x + 1, pos.y + 1.5, pos.z)
    scene.add(pl2)
    pointLights.push(pl2)
  })

  lights = { ambient, hemi, dirLights, pointLights }

  console.log('[光照] 三层光照系统配置完成（3000K 暖黄光）')
  return lights
}

/**
 * 获取灯光对象
 */
export function getLights() { return lights }

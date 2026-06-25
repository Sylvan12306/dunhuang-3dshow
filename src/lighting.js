/**
 * 分层光照系统模块（博物馆展陈版 - 消除死黑优化）
 * 六层分层光源：基底环境光 + 造像定向主光 + 造像轮廓勾边光 + 壁画专属补光 + 空间纵深辅光 + 柔和阴影
 * 解决画面过暗、壁画雕塑细节丢失问题，保留博物馆暗光展陈氛围，杜绝过曝
 * 不增加模型体积，仅靠光照参数调整
 */
import * as THREE from 'three'

// === 敦煌低饱和暖棕配色（统一规范）===
const WARM_KEY_COLOR = 0xffe8c4    // 造像定向主光（暖金色 #FFE8C4）
const WARM_FILL_COLOR = 0xe8b87a   // 暖棕补光
const RIM_GOLD_COLOR = 0xd4af37    // 造像轮廓勾边光（暗金色 #D4AF37）
const MURAL_LIGHT_COLOR = 0xf2e2c0 // 壁画专属补光（暖黄柔光 #F2E2C0）
const CAVE_AMBIENT_COLOR = 0xC9B89C // 基础环境光（暖棕低饱和 #C9B89C）

// 全局灯光引用
let lights = {}

/**
 * 配置分层光照系统
 * @param {THREE.Scene} scene - Three.js 场景
 */
export function setupLighting(scene) {
  // ============================================================
  // 第一层：AmbientLight 基础环境光
  // 暖棕低饱和 #C9B89C，强度0.55，柔和漫反射，消除大面积死黑
  // ============================================================
  const ambient = new THREE.AmbientLight(CAVE_AMBIENT_COLOR, 0.55)
  scene.add(ambient)

  // ============================================================
  // 第二层：HemisphereLight 半球光
  // 上方暖金 + 下方地面反射灰棕，模拟洞窟顶部光源 + 地面漫反射
  // ============================================================
  const hemi = new THREE.HemisphereLight(
    WARM_KEY_COLOR,    // 天空色：暖金
    0x8a7a5a,          // 地面色：暖灰棕（地面反射，提亮地面暗部）
    0.45               // 强度（提升，避免地面死黑）
  )
  hemi.position.set(0, 10, 0)
  scene.add(hemi)

  // ============================================================
  // 第三层：DirectionalLight 造像定向主光
  // 暖金色 #FFE8C4，强度0.7，从斜前方打亮佛像正面，还原轮廓与造型
  // ============================================================
  const dirLights = []

  // 主平行光：模拟洞窟入口方向自然光，照射中央主尊
  const dirMain = new THREE.DirectionalLight(WARM_KEY_COLOR, 0.7)
  dirMain.position.set(8, 6, 4)
  dirMain.castShadow = true
  // 柔和模糊阴影参数
  dirMain.shadow.mapSize.width = 2048
  dirMain.shadow.mapSize.height = 2048
  dirMain.shadow.camera.near = 0.5
  dirMain.shadow.camera.far = 60
  dirMain.shadow.camera.left = -35
  dirMain.shadow.camera.right = 35
  dirMain.shadow.camera.top = 35
  dirMain.shadow.camera.bottom = -35
  dirMain.shadow.bias = -0.0008
  dirMain.shadow.normalBias = 0.02
  dirMain.shadow.radius = 6         // 阴影模糊半径增大（更柔和）
  dirMain.shadow.intensity = 0.6    // 降低阴影强度，阴影暗部保留微弱反光，杜绝完全死黑
  scene.add(dirMain)
  dirLights.push(dirMain)

  // 辅助平行光 1：洞窟顶部射灯（暖金柔光，表现洞窟纵深）
  const dirTop = new THREE.DirectionalLight(WARM_FILL_COLOR, 0.3)
  dirTop.position.set(20, 10, 0)
  dirTop.castShadow = false
  scene.add(dirTop)
  dirLights.push(dirTop)

  // 辅助平行光 2：远景洞窟补光（避免深处死黑）
  const dirFar = new THREE.DirectionalLight(WARM_FILL_COLOR, 0.25)
  dirFar.position.set(35, 4, 2)
  dirFar.castShadow = false
  scene.add(dirFar)
  dirLights.push(dirFar)

  // ============================================================
  // 第四层：点光源 - 造像定向主光 + 轮廓勾边光 + 壁画专属补光（精简版）
  // 优化：每个洞窟仅保留3个核心光源（主光+轮廓光+壁画光），合并冗余光源
  // 原方案每洞窟5-7个点光源，现精简为3个，减少实时光照计算开销
  // ============================================================
  const pointLights = []

  // 洞窟位置数据（匹配 controls.js 中的 CAVE_POSITIONS）
  const cavePositions = [
    { x: 8,  y: 0, z: 1.6, name: '285窟' },
    { x: 15, y: 0, z: 1.6, name: '45窟' },
    { x: 22, y: 0, z: 1.6, name: '217窟' },
    { x: 29, y: 0, z: 1.6, name: '17窟' },
    { x: 36, y: 0, z: 1.6, name: '3窟' },
  ]

  cavePositions.forEach((pos, i) => {
    const sculptureX = pos.x + 6.5  // 佛龛造像位置

    // --- 造像定向主光：合并原左前+右前两个点光源为一个居中光源 ---
    // 暖金色 #FFE8C4，强度1.0（合并后增强），从正前方打亮佛像
    const mainPL = new THREE.PointLight(WARM_KEY_COLOR, 1.0, 10, 2)
    mainPL.position.set(sculptureX - 2, 1.8, pos.z)
    scene.add(mainPL)
    pointLights.push(mainPL)

    // --- 造像轮廓勾边光：弱暗金色 #D4AF37，强度0.25，从后方侧打 ---
    const rimLight = new THREE.PointLight(RIM_GOLD_COLOR, 0.25, 6, 2)
    rimLight.position.set(sculptureX + 1.2, 1.8, pos.z)
    scene.add(rimLight)
    pointLights.push(rimLight)

    // --- 壁画专属补光灯：合并原左壁画+右壁画两个光源为一个居中光源 ---
    // 暖黄柔光 #F2E2C0，强度0.8（合并后增强），居中照射壁画区域
    const muralLight = new THREE.PointLight(MURAL_LIGHT_COLOR, 0.8, 8, 2)
    muralLight.position.set(sculptureX - 1, 2.0, pos.z)
    scene.add(muralLight)
    pointLights.push(muralLight)

    // 中央主尊（45窟盛唐）额外加强光照，作为第一视觉焦点
    if (i === 1) {
      // 主尊顶部聚光（强化视觉焦点）
      const focusLight = new THREE.PointLight(WARM_KEY_COLOR, 0.8, 10, 2)
      focusLight.position.set(sculptureX - 1, 3.0, pos.z)
      scene.add(focusLight)
      pointLights.push(focusLight)
    }
  })

  // ============================================================
  // 第五层：空间纵深辅光（精简版）
  // 优化：减少走廊侧光数量，从6个位置12个光源精简为3个位置6个光源
  // 仅保留关键转角处侧光，减少实时光照计算开销
  // ============================================================
  const corridorPositions = [12, 26, 40]
  corridorPositions.forEach((x) => {
    // 左墙侧光
    const wallLightL = new THREE.PointLight(WARM_FILL_COLOR, 0.25, 10, 2)
    wallLightL.position.set(x, 2.5, 5)
    scene.add(wallLightL)
    pointLights.push(wallLightL)

    // 右墙侧光
    const wallLightR = new THREE.PointLight(WARM_FILL_COLOR, 0.25, 10, 2)
    wallLightR.position.set(x, 2.5, -5)
    scene.add(wallLightR)
    pointLights.push(wallLightR)
  })

  lights = { ambient, hemi, dirLights, pointLights }

  console.log('[光照] 分层光照系统配置完成（消除死黑 + 保留暗光氛围）')
  return lights
}

/**
 * 获取灯光对象
 */
export function getLights() { return lights }

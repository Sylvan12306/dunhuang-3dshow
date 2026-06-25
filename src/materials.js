/**
 * PBR 物理材质模块（博物馆展陈版）
 * 全套敦煌低饱和配色：哑光暖灰石材墙面 + 浅棕拉丝石材地面 + 深炭黑造像 + 暗金高光
 * 壁画低饱和做旧褪色质感，装饰线哑光暗金金属，全局禁用高饱和亮色
 * 不增加模型面数，仅靠材质参数与程序化贴图提升质感
 */
import * as THREE from 'three'

// === 敦煌低饱和暖棕配色（统一规范）===
// 全局色调：#8B6914（暗棕）#D4AF37（暗金）#221A12（深炭黑）#C9B89C（暖灰）
const DUNHUANG_PALETTE = {
  darkGold:    0x8B6914,  // 暗棕金（主色调）
  gold:        0xD4AF37,  // 暗金（强调色）
  charcoal:    0x221A12,  // 深炭黑（造像基底）
  warmGray:    0xC9B89C,  // 暖灰（石材）
  caveWall:    0x5a4a36,  // 哑光洞窟石材（略微提亮，避免墙面全黑）
  caveFloor:   0x4a3e2e,  // 浅棕拉丝石材（略微提亮）
  muralBase:   0x9a8a6a,  // 壁画做旧底色（提亮，保证壁画图案可见）
  agedYellow:  0xb8a070,  // 年代泛黄纹理
}

// === 全局材质实例缓存（统一材质实例，合并重复材质，降低WebGL绘制批次）===
const materialCache = new Map()

/**
 * 获取或创建材质实例（相同参数复用同一实例，减少WebGL绘制批次）
 * @param {string} key - 材质缓存键名
 * @param {Object} params - MeshStandardMaterial 参数
 * @returns {THREE.MeshStandardMaterial} 材质实例
 */
function getOrCreateMaterial(key, params) {
  if (materialCache.has(key)) {
    return materialCache.get(key)
  }
  const material = new THREE.MeshStandardMaterial(params)
  materialCache.set(key, material)
  return material
}

// === 材质参数预设（博物馆展陈版 - 消除死黑优化）===
const MATERIAL_PRESETS = {
  // 壁画材质：低饱和做旧褪色质感，提亮自发光保证壁画图案清晰可见
  mural: {
    roughness: 0.85,
    metalness: 0.0,
    bumpScale: 0.04,
    envMapIntensity: 0.2,
    color: DUNHUANG_PALETTE.muralBase,
    emissive: 0x3a2e1e,      // 提升自发光，避免壁画死黑，保证人物纹样可见
    emissiveIntensity: 0.18,
  },
  // 彩塑材质：深炭黑基底 + 暗金边缘高光，提升暗部反光还原造型结构
  sculpture: {
    roughness: 0.5,
    metalness: 0.3,
    bumpScale: 0.06,
    envMapIntensity: 0.8,
    color: 0x3a2a1e,         // 略微提亮基底色，暗部能透出造型结构
    emissive: 0x3a2e1e,      // 提升自发光，区分剪影轮廓，不再一团死黑
    emissiveIntensity: 0.12,
  },
  // 墙体材质：哑光暖灰石材，粗糙度高，增加微弱自发光避免角落全黑
  wall: {
    roughness: 0.9,
    metalness: 0.0,
    bumpScale: 0.10,
    envMapIntensity: 0.15,
    color: DUNHUANG_PALETTE.caveWall,
    emissive: 0x1a1410,      // 微弱自发光，避免墙角全黑
    emissiveIntensity: 0.06,
  },
  // 地板材质：浅棕拉丝石材，微弱漫反射，增加微弱自发光
  floor: {
    roughness: 0.92,
    metalness: 0.0,
    bumpScale: 0.02,
    envMapIntensity: 0.05,   // 微弱环境反射
    color: DUNHUANG_PALETTE.caveFloor,
    emissive: 0x1a1410,      // 微弱自发光，避免地面全黑
    emissiveIntensity: 0.04,
  },
  // 金属画框：哑光暗金金属，金属度0.2，不刺眼
  frame: {
    roughness: 0.45,
    metalness: 0.2,
    bumpScale: 0.02,
    envMapIntensity: 0.4,
    color: DUNHUANG_PALETTE.darkGold,
  },
  // 藻井材质：低饱和暖棕，微金属感
  caisson: {
    roughness: 0.65,
    metalness: 0.15,
    bumpScale: 0.04,
    envMapIntensity: 0.35,
    color: DUNHUANG_PALETTE.darkGold,
  },
  // 崖壁材质：哑光暖灰石材，粗糙度高，强凹凸
  cliff: {
    roughness: 0.95,
    metalness: 0.0,
    bumpScale: 0.12,
    envMapIntensity: 0.10,
    color: 0x5a4a32,
  },
  // 栈道材质：浅棕拉丝石材
  walkway: {
    roughness: 0.85,
    metalness: 0.0,
    bumpScale: 0.05,
    envMapIntensity: 0.15,
    color: DUNHUANG_PALETTE.caveFloor,
  },
  // 装饰线条：哑光暗金金属
  decoration: {
    roughness: 0.40,
    metalness: 0.2,
    bumpScale: 0.02,
    envMapIntensity: 0.45,
    color: DUNHUANG_PALETTE.gold,
  },
}

/**
 * 增强 PBR 材质（博物馆展陈版 - 材质实例合并优化）
 * 遍历模型所有 Mesh，根据名称匹配材质预设，调整 PBR 参数
 * 优化：相同预设的Mesh共享同一材质实例，减少WebGL绘制批次
 * @param {THREE.Group} model - glb 模型
 */
export function enhancePBRMaterials(model) {
  let enhancedCount = 0
  // 预设类型到材质实例的映射（合并重复材质）
  const presetMaterialMap = new Map()

  model.traverse((child) => {
    if (child.isMesh && child.material) {
      const name = child.name || ''
      const preset = matchMaterialPreset(name)

      if (preset) {
        // 材质实例合并：相同预设类型共享同一材质实例
        const presetKey = getPresetKey(name)
        if (presetKey && !presetMaterialMap.has(presetKey)) {
          // 首次遇到该预设类型，创建材质实例并应用预设
          const newMaterial = child.material.clone()
          applyPBRPreset(newMaterial, preset)
          presetMaterialMap.set(presetKey, newMaterial)
        }
        if (presetKey && presetMaterialMap.has(presetKey)) {
          // 复用已创建的材质实例，减少WebGL绘制批次
          child.material = presetMaterialMap.get(presetKey)
        } else {
          applyPBRPreset(child.material, preset)
        }
        enhancedCount++
      }

      // 通用材质优化
      // 确保 sRGB 色彩空间（贴图颜色正确）
      if (child.material.map) {
        child.material.map.colorSpace = THREE.SRGBColorSpace
      }
      if (child.material.emissiveMap) {
        child.material.emissiveMap.colorSpace = THREE.SRGBColorSpace
      }

      // 启用环境贴图反射（增强质感，强度低避免过亮）
      child.material.envMapIntensity = preset ? preset.envMapIntensity : 0.2

      // 地板材质特殊锁定：杜绝任何反射变色
      if (name.includes('地板') || name.includes('地面')) {
        child.material.envMapIntensity = 0.0
        child.material.metalness = 0.0
        child.material.roughness = 0.95
        child.material.color = new THREE.Color(DUNHUANG_PALETTE.caveFloor)
        child.material.toneMapped = true
      }

      // 造像材质特殊处理：深炭黑基底 + 暗金边缘高光，提升暗部反光还原造型
      if (name.includes('彩塑') || name.includes('主佛') || name.includes('迦叶') ||
          name.includes('阿难') || name.includes('菩萨') || name.includes('天王') ||
          name.includes('力士')) {
        // 提升金属感反射边缘光，暗部能透出造型结构
        child.material.metalness = Math.max(child.material.metalness || 0, 0.3)
        child.material.roughness = Math.min(child.material.roughness || 1, 0.5)
        // 提升自发光，避免纯黑一团丢失细节
        if (!child.material.emissive || child.material.emissive.getHex() === 0) {
          child.material.emissive = new THREE.Color(0x3a2e1e)
          child.material.emissiveIntensity = 0.12
        }
        // 提升环境贴图反射，让造像暗部有微弱反光
        child.material.envMapIntensity = Math.max(child.material.envMapIntensity || 0, 0.8)
      }

      // 材质需要更新
      child.material.needsUpdate = true
    }
  })

  console.log('[材质] 博物馆展陈 PBR 材质增强完成，共 ' + enhancedCount + ' 个对象，合并为 ' + presetMaterialMap.size + ' 个材质实例')
}

/**
 * 根据对象名称获取预设缓存键名（用于材质实例合并）
 */
function getPresetKey(name) {
  if (!name) return null
  if (name.includes('壁画') || name.includes('经变画') || name.includes('飞天') ||
      name.includes('伎乐') || name.includes('供养人') || name.includes('护法') ||
      name.includes('藻井') || name.includes('千佛') || name.includes('市井')) return 'mural'
  if (name.includes('彩塑') || name.includes('主佛') || name.includes('迦叶') ||
      name.includes('阿难') || name.includes('菩萨') || name.includes('天王') ||
      name.includes('力士') || name.includes('基座')) return 'sculpture'
  if (name.includes('藻井') || name.includes('覆斗')) return 'caisson'
  if (name.includes('崖壁') || name.includes('崖') || name.includes('戈壁')) return 'cliff'
  if (name.includes('栈道') || name.includes('阶梯') || name.includes('通道')) return 'walkway'
  if (name.includes('框') || name.includes('九层楼') || name.includes('标签') ||
      name.includes('装饰') || name.includes('线条')) return 'frame'
  if (name.includes('墙') || name.includes('洞窟') || name.includes('覆斗')) return 'wall'
  if (name.includes('地板') || name.includes('地面')) return 'floor'
  return null
}

/**
 * 根据对象名称匹配材质预设
 */
function matchMaterialPreset(name) {
  if (!name) return null

  // 壁画类
  if (name.includes('壁画') || name.includes('经变画') || name.includes('飞天') ||
      name.includes('伎乐') || name.includes('供养人') || name.includes('护法') ||
      name.includes('藻井') || name.includes('千佛') || name.includes('市井')) {
    return MATERIAL_PRESETS.mural
  }

  // 彩塑类
  if (name.includes('彩塑') || name.includes('主佛') || name.includes('迦叶') ||
      name.includes('阿难') || name.includes('菩萨') || name.includes('天王') ||
      name.includes('力士') || name.includes('基座')) {
    return MATERIAL_PRESETS.sculpture
  }

  // 藻井类
  if (name.includes('藻井') || name.includes('覆斗')) {
    return MATERIAL_PRESETS.caisson
  }

  // 崖壁类
  if (name.includes('崖壁') || name.includes('崖') || name.includes('戈壁')) {
    return MATERIAL_PRESETS.cliff
  }

  // 栈道类
  if (name.includes('栈道') || name.includes('阶梯') || name.includes('通道')) {
    return MATERIAL_PRESETS.walkway
  }

  // 画框/装饰线类
  if (name.includes('框') || name.includes('九层楼') || name.includes('标签') ||
      name.includes('装饰') || name.includes('线条')) {
    return MATERIAL_PRESETS.frame
  }

  // 墙体类
  if (name.includes('墙') || name.includes('洞窟') || name.includes('覆斗')) {
    return MATERIAL_PRESETS.wall
  }

  // 地板类
  if (name.includes('地板') || name.includes('地面')) {
    return MATERIAL_PRESETS.floor
  }

  return null
}

/**
 * 应用 PBR 预设到材质
 */
function applyPBRPreset(material, preset) {
  // 处理材质数组（一个 Mesh 可能有多个材质）
  const materials = Array.isArray(material) ? material : [material]

  materials.forEach((mat) => {
    // 粗糙度：控制表面光滑程度（壁画粗糙、彩塑略光滑）
    if (mat.roughness !== undefined) {
      mat.roughness = preset.roughness
    }

    // 金属度：控制金属反射（壁画无、画框低金属度）
    if (mat.metalness !== undefined) {
      mat.metalness = preset.metalness
    }

    // 敦煌低饱和配色：如果材质没有贴图，应用预设底色
    if (preset.color && !mat.map) {
      mat.color = new THREE.Color(preset.color)
    }

    // 凹凸强度：控制表面凹凸细节（风化痕迹）
    if (mat.bumpMap && mat.bumpScale !== undefined) {
      mat.bumpScale = preset.bumpScale
    }

    // 法线贴图强度（如果有）
    if (mat.normalMap && mat.normalScale) {
      mat.normalScale.set(preset.bumpScale, preset.bumpScale)
    }

    // 环境贴图强度
    mat.envMapIntensity = preset.envMapIntensity

    // 自发光（壁画微弱自发光避免死黑，造像微弱暖光区分轮廓）
    if (preset.emissive !== undefined) {
      mat.emissive = new THREE.Color(preset.emissive)
      mat.emissiveIntensity = preset.emissiveIntensity || 0.05
    }

    mat.needsUpdate = true
  })
}

/**
 * 手动创建风化质感材质（备用方案）
 * 当 Blender 未烘焙贴图时，用程序化材质模拟风化效果
 */
export function createWeatheredMaterial(baseColor = 0x4a3826) {
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.88,
    metalness: 0.0,
    bumpScale: 0.04,
  })

  // 程序化凹凸贴图（模拟风化斑驳）
  const bumpTexture = createProceduralBumpTexture()
  material.bumpMap = bumpTexture
  material.needsUpdate = true

  return material
}

/**
 * 创建程序化凹凸贴图（模拟风化痕迹）
 */
function createProceduralBumpTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 基础灰色
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)

  // 随机斑点（模拟风化斑驳）
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 8 + 2
    const gray = Math.floor(Math.random() * 100 + 100)
    ctx.fillStyle = 'rgb(' + gray + ',' + gray + ',' + gray + ')'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

/**
 * 获取敦煌配色方案
 */
export function getDunhuangPalette() {
  return DUNHUANG_PALETTE
}

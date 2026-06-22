/**
 * PBR 物理材质模块（升级版）
 * 对接 Blender 烘焙 + AI 生成的壁画风化贴图、泥塑贴图
 * 新增：敦煌传统矿物色彩体系（石青、石绿、朱砂、土黄、赭石）
 * 调整粗糙度、金属度、凹凸强度还原古壁画、彩塑真实风化质感
 */
import * as THREE from 'three'

// === 敦煌传统矿物色彩体系 ===
const MINERAL_COLORS = {
  shiqing:  0x4A7C8C,  // 石青（蓝绿色，壁画底色）
  shilv:    0x5B8C6A,  // 石绿（绿色，植物纹样）
  zhusha:   0xC44536,  // 朱砂（红色，装饰边框）
  tuyang:   0xC4A668,  // 土黄（主色调，墙面底色）
  zheshi:   0x8B5A3C,  // 赭石（棕色，木质构件）
}

// 材质参数预设（融入矿物色彩）
const MATERIAL_PRESETS = {
  // 壁画材质：石青底色，粗糙度高，有凹凸风化
  mural: {
    roughness: 0.85,
    metalness: 0.0,
    bumpScale: 0.05,
    envMapIntensity: 0.3,
    color: MINERAL_COLORS.shiqing,
  },
  // 彩塑材质：土黄底色，微金属感（金箔），有凹凸
  sculpture: {
    roughness: 0.65,
    metalness: 0.15,
    bumpScale: 0.08,
    envMapIntensity: 0.5,
    color: MINERAL_COLORS.tuyang,
  },
  // 墙体材质：赭石底色，粗糙度高，强凹凸
  wall: {
    roughness: 0.92,
    metalness: 0.0,
    bumpScale: 0.12,
    envMapIntensity: 0.2,
    color: MINERAL_COLORS.zheshi,
  },
  // 地板材质：固定哑光仿古砂岩，低饱和度赭石土棕，无渐变无闪烁
  floor: {
    roughness: 1.0,
    metalness: 0.0,
    bumpScale: 0.02,
    envMapIntensity: 0.0,  // 环境贴图强度归零，杜绝反射变色
    color: 0x3a2e1e,       // 固定低饱和度赭石土棕色调
  },
  // 金属画框：朱砂+金，低粗糙度，高金属感
  frame: {
    roughness: 0.35,
    metalness: 0.8,
    bumpScale: 0.02,
    envMapIntensity: 0.8,
    color: MINERAL_COLORS.zhusha,
  },
  // 藻井材质：石绿底色，微金属感，有凹凸
  caisson: {
    roughness: 0.55,
    metalness: 0.2,
    bumpScale: 0.04,
    envMapIntensity: 0.6,
    color: MINERAL_COLORS.shilv,
  },
  // 崖壁材质：赭石+土黄混合，粗糙度高，强凹凸
  cliff: {
    roughness: 0.95,
    metalness: 0.0,
    bumpScale: 0.15,
    envMapIntensity: 0.15,
    color: 0x6B4A2A,
  },
  // 栈道材质：赭石色木板
  walkway: {
    roughness: 0.8,
    metalness: 0.0,
    bumpScale: 0.06,
    envMapIntensity: 0.3,
    color: MINERAL_COLORS.zheshi,
  },
}

/**
 * 增强 PBR 材质
 * 遍历模型所有 Mesh，根据名称匹配材质预设，调整 PBR 参数
 * @param {THREE.Group} model - glb 模型
 */
export function enhancePBRMaterials(model) {
  let enhancedCount = 0

  model.traverse((child) => {
    if (child.isMesh && child.material) {
      const name = child.name || ''
      const preset = matchMaterialPreset(name)

      if (preset) {
        applyPBRPreset(child.material, preset)
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

      // 启用环境贴图反射（增强质感）
      child.material.envMapIntensity = preset ? preset.envMapIntensity : 0.3

      // 地板材质特殊锁定：杜绝任何反射变色
      if (name.includes('地板') || name.includes('地面')) {
        child.material.envMapIntensity = 0.0
        child.material.metalness = 0.0
        child.material.roughness = 1.0
        // 固定颜色，不受光照环境影响产生变色
        child.material.color = new THREE.Color(0x3a2e1e)
        child.material.toneMapped = true
      }

      // 材质需要更新
      child.material.needsUpdate = true
    }
  })

  console.log('[材质] PBR 材质增强完成，共 ' + enhancedCount + ' 个对象')
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

  // 画框类
  if (name.includes('框') || name.includes('九层楼') || name.includes('标签')) {
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

    // 金属度：控制金属反射（壁画无、画框高）
    if (mat.metalness !== undefined) {
      mat.metalness = preset.metalness
    }

    // 矿物色彩：如果材质没有贴图，应用矿物底色
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

    mat.needsUpdate = true
  })
}

/**
 * 手动创建风化质感材质（备用方案）
 * 当 Blender 未烘焙贴图时，用程序化材质模拟风化效果
 */
export function createWeatheredMaterial(baseColor = 0x8a6a3a) {
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.85,
    metalness: 0.0,
    bumpScale: 0.05,
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

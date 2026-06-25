/**
 * glTF 模型加载模块
 * 读取从 dunhuang_museum.blend 导出的 glb 文件
 * 实现异步加载、加载进度提示、塑像自带动画播放
 * 优化：meshopt 压缩（比 Draco 更快解码）、WebP 纹理、渐进式渲染
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

// 全局模型引用
let loadedModel = null

// glb 模型路径（使用 Vite base 路径，适配 GitHub Pages 部署）
const BASE = import.meta.env.BASE_URL
const MODEL_URL = BASE + 'models/dunhuang_museum_v2.glb'

/**
 * 异步加载 glb 模型
 * @param {string} url - glb 文件路径
 * @param {Function} onProgress - 加载进度回调 (0~1)
 * @returns {Promise<THREE.Group>} 加载完成的模型
 */
export function loadModel(url = MODEL_URL, onProgress) {
  return new Promise((resolve, reject) => {
    // --- glTF 加载器 ---
    const loader = new GLTFLoader()
    // meshopt 解码器（WASM，解码速度比 Draco 快 2-3 倍）
    loader.setMeshoptDecoder(MeshoptDecoder)

    console.log('[模型] 开始加载 glb: ' + url)

    // 记录开始时间，用于估算进度
    let lastLoaded = 0
    let estimatedTotal = 0

    loader.load(
      url,
      // 加载完成回调
      (gltf) => {
        const model = gltf.scene

        // 加载完成时强制进度为 100%（彻底解决进度条超过 100% 问题）
        if (onProgress) {
          onProgress(1.0)
        }

        // 遍历模型，设置阴影和材质
        model.traverse((child) => {
          if (child.isMesh) {
            // 启用阴影投射
            child.castShadow = true
            child.receiveShadow = true

            // 标记可交互对象（用于 Raycaster 射线拾取）
            // Blender 中命名的对象会自动标记
            child.userData.interactive = isInteractiveObject(child.name)
          }
        })

        // --- 动画混合器（如果 glb 模型自带动画）---
        if (gltf.animations && gltf.animations.length > 0) {
          model.mixer = new THREE.AnimationMixer(model)
          // 播放第一个动画
          const action = model.mixer.clipAction(gltf.animations[0])
          action.play()
          console.log('[模型] 检测到 ' + gltf.animations.length + ' 个动画，已播放第一个')
        }

        // --- 相机适配：根据模型包围盒调整相机 ---
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        console.log('[模型] 模型尺寸:', size.x.toFixed(1) + 'x' + size.y.toFixed(1) + 'x' + size.z.toFixed(1))
        console.log('[模型] 模型中心:', center.x.toFixed(1) + ', ' + center.y.toFixed(1) + ', ' + center.z.toFixed(1))

        loadedModel = model
        console.log('[模型] glb 加载完成')
        resolve(model)
      },
      // 加载进度回调
      (xhr) => {
        if (onProgress) {
          let progress = 0
          if (xhr.lengthComputable) {
            // 服务器返回了 Content-Length，可以精确计算进度
            estimatedTotal = xhr.total
            progress = xhr.loaded / Math.max(xhr.total, 1)
          } else if (estimatedTotal > 0) {
            // 使用之前估算的总大小计算进度
            progress = xhr.loaded / estimatedTotal
          } else {
            // 首次收到数据但不知道总大小，根据已下载量估算
            // 模型约 13MB，首次收到数据时估算总大小
            if (xhr.loaded > 0 && lastLoaded === 0) {
              estimatedTotal = 13 * 1024 * 1024 // 13MB 估算值
            }
            if (estimatedTotal > 0) {
              progress = xhr.loaded / estimatedTotal
            } else {
              // 完全无法估算时，显示最低进度表示正在下载
              progress = 0.05
            }
          }
          // 进度限制在 0~0.95 之间（加载完成时才到 100%，彻底解决进度超过 100%）
          progress = Math.max(0, Math.min(progress, 0.95))
          onProgress(progress)
          lastLoaded = xhr.loaded
        }
      },
      // 加载错误回调
      (error) => {
        console.error('[模型] glb 加载失败:', error)
        reject(error)
      }
    )
  })
}

/**
 * 判断对象是否为可交互对象（壁画、彩塑、洞窟构件）
 * 根据 Blender 中的命名规则识别
 */
function isInteractiveObject(name) {
  if (!name) return false
  // 壁画类
  if (name.includes('壁画') || name.includes('经变画') || name.includes('飞天') ||
      name.includes('伎乐') || name.includes('供养人') || name.includes('护法') ||
      name.includes('藻井') || name.includes('千佛')) {
    return true
  }
  // 彩塑类
  if (name.includes('彩塑') || name.includes('主佛') || name.includes('迦叶') ||
      name.includes('阿难') || name.includes('菩萨') || name.includes('天王') ||
      name.includes('力士')) {
    return true
  }
  // 洞窟构件
  if (name.includes('洞窟') || name.includes('佛龛') || name.includes('门洞')) {
    return true
  }
  return false
}

/**
 * 获取已加载的模型
 */
export function getLoadedModel() { return loadedModel }

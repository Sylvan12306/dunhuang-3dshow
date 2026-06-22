import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression'

// Vite 配置 - 敦煌 3DShow 数字展馆
// 针对大体积 glb 模型做分包压缩、Brotli/Gzip 双重传输优化
export default defineConfig({
  server: {
    port: 3000,
    open: true,
    // 允许加载大文件
    fs: {
      strict: false
    },
    // 启用 CORS 便于 Service Worker 缓存
    cors: true,
  },
  build: {
    // 分包策略：three.js 单独打包
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three'],
        }
      }
    },
    // 资源分包大小警告阈值（glb 模型较大）
    chunkSizeWarningLimit: 80000,
    // 启用压缩
    minify: 'esbuild',
  },
  plugins: [
    // Brotli 压缩 - 比 Gzip 压缩率高 15-20%，无损传输优化
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,  // 超过 10KB 的文件启用压缩
      deleteOriginFile: false,
      filter: /\.(js|mjs|json|css|html|glb|gltf)$/i,  // 包含 GLB 模型文件
      compressionOptions: {
        level: 6,  // Brotli 压缩级别（1-11，6 为速度与压缩率最佳平衡）
      },
    }),
    // Gzip 压缩 - 兼容不支持 Brotli 的浏览器
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240,
      deleteOriginFile: false,
      filter: /\.(js|mjs|json|css|html|glb|gltf)$/i,  // 包含 GLB 模型文件
    }),
  ],
  // 静态资源优化
  assetsInclude: ['**/*.glb', '**/*.gltf'],
})

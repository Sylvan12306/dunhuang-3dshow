import { defineConfig } from 'vite'

// Vite 配置 - 敦煌 3DShow 数字展馆
// Vite 会自动将 public 目录下的文件复制到 dist 根目录：
//   public/sw.js -> dist/sw.js
//   public/models/dunhuang_museum_v2.glb -> dist/models/dunhuang_museum_v2.glb
export default defineConfig({
  // GitHub Pages 项目站点 base 路径
  base: '/dunhuang-3dshow/',
  server: {
    port: 3000,
    open: true,
    fs: {
      strict: false
    },
    cors: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three'],
        }
      }
    },
    chunkSizeWarningLimit: 80000,
    minify: 'esbuild',
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
})

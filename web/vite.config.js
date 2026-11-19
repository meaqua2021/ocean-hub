import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: { port: 5211, proxy: { '/api': 'http://127.0.0.1:5210' } },
  /* dist 不复制 public，静态资源由服务端回落读取 web/public，避免同一份图标存两处 */
  build: { outDir: 'dist', copyPublicDir: false }
});

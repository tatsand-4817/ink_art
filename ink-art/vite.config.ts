import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Service Worker は絶対パスのスコープを必要とするため、base は '/' 前提。
// サブパスに置く場合は `vite build --base=/ink-art/` のように渡すこと。
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon-180x180.png', 'icons/favicon-96x96.png'],
      manifest: {
        name: 'インクアート',
        short_name: 'インクアート',
        description: '水面に落としたインクの滲みと渦をリアルタイムに描くアートアプリ。',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // 起動画面はキャンバスの既定色に合わせる
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            // Android はアイコンを端末ごとの形に切り抜くので、
            // 中身を中央 80% に収めた専用の絵を別に渡す
            src: 'icons/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 完全オフライン起動が要件なので、ビルド成果物は全部先読みさせる
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // 開発サーバーでも Service Worker の挙動を確認できるようにする
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
  },
});

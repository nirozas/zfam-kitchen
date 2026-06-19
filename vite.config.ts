import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        short_name: "Zoabi Kitchen",
        name: "Zoabi Family Kitchen",
        description: "Premium family recipe planner and kitchen companion.",
        icons: [
            {
                src: "/logo.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable"
            },
            {
                src: "/logo.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
            }
        ],
        start_url: "/",
        display: "standalone",
        theme_color: "#EA580C",
        background_color: "#ffffff"
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

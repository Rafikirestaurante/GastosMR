import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const rafikiManifest = {
  id: "/mesas",
  name: "Rafiki Pedidos",
  short_name: "Rafiki",
  description:
    "Aplicación PWA interna de Rafiki Pedidos. Al instalarse abre por defecto en Panel Mesas y valida sesión para accesos administrativos.",
  lang: "es",
  start_url: "/mesas?app=mesas",
  scope: "/",
  display: "standalone",
  display_override: ["standalone", "minimal-ui"],
  orientation: "portrait",
  background_color: "#fff4e6",
  theme_color: "#f97316",
  categories: ["food", "business", "productivity"],
  icons: [
    {
      src: "/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable"
    },
    {
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ],
  shortcuts: [
    {
      name: "Panel mesas",
      short_name: "Mesas",
      description: "Abrir el panel de mesas para meseros.",
      url: "/mesas?source=pwa-shortcut",
      icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }]
    },
    {
      name: "Pedidos de hoy",
      short_name: "Pedidos",
      description: "Abrir el panel administrativo de pedidos.",
      url: "/admin?source=pwa-shortcut",
      icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }]
    },
    {
      name: "Gerencia",
      short_name: "Gerencia",
      description: "Abrir la sección privada de Gerencia.",
      url: "/gerencia?source=pwa-shortcut",
      icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }]
    },
    {
      name: "Gastos rápidos",
      short_name: "Gastos",
      description: "Abrir Gerencia para registrar gastos.",
      url: "/gerencia?source=pwa-shortcut&tab=gastos",
      icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }]
    }
  ]
};

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("@supabase") || id.includes("@isaacs") || id.includes("ws"))
            return "vendor-supabase";
          if (id.includes("workbox")) return "vendor-pwa";
          return undefined;
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "logo-rafiki.png", "icon-180.png", "icon-192.png", "icon-512.png"],
      manifest: rafikiManifest,
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json}"],
        globIgnores: ["**/rafiki-version.json", "**/manifest.json"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.includes("supabase.co"),
            handler: "NetworkOnly",
            method: "GET",
            options: {
              cacheName: "rafiki-supabase-network-only"
            }
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === "image" || /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "rafiki-images",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "rafiki-pages-network-first",
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          },
          {
            urlPattern: ({ url }) =>
              url.pathname === "/rafiki-version.json" ||
              url.pathname === "/manifest.webmanifest" ||
              url.pathname === "/manifest.json",
            handler: "NetworkFirst",
            options: {
              cacheName: "rafiki-pwa-metadata-network-first",
              networkTimeoutSeconds: 2,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 10
              }
            }
          },
          {
            urlPattern: ({ request }) => ["script", "style", "font"].includes(request.destination),
            handler: "NetworkFirst",
            options: {
              cacheName: "rafiki-static-assets-network-first",
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]
});

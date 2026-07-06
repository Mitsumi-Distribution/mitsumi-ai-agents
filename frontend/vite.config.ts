import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // vite preview (used for supervisor `start`) reads `preview`, not `server`.
  // Keep allowedHosts true so the Cloudflare preview hostname isn't blocked.
  preview: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache"
    }
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: false,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache"
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "[name].[hash].js",
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "[name].[hash].[ext]"
      }
    }
  }
});

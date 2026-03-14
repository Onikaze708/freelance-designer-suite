import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const basePath = process.env.APP_BASE_PATH || "/studio/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4100"
    }
  },
  preview: {
    port: 4173
  }
});

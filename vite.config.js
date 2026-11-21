import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Для GitHub Pages сборка идёт в подпапку (/MU_medical_app/) — путь задаёт workflow через BASE_PATH.
  // Локально, на Netlify и Vercel приложение остаётся в корне сайта.
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});

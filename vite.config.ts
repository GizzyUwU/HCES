import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindCSS from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Icons from "unplugin-icons/vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const viteConfig = defineConfig({
  plugins: [
    tailwindCSS(),
    solidPlugin(),
    Icons({ compiler: "jsx", jsx: "preact" }),
  ],
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/api": {
        target: process.env["BACKEND_URL"] || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});

export default viteConfig;

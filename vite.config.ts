import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const viteConfig = defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    target: "esnext",
  },
  resolve: {
    conditions: ["development", "browser"],
  },
});

export default viteConfig;
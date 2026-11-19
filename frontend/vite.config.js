import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// En desarrollo, Vite corre en :5173 y reenvía /api al backend en :3000 (mismo origen → la cookie de sesión funciona).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3000", timeout: 300000, proxyTimeout: 300000 } }
  }
});

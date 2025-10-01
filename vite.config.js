import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: "localhost",
    port: 5173,

    proxy: {
      "/api": "http://localhost:3001",
    },

    watch: {
      usePolling: true,
    },
  },
});

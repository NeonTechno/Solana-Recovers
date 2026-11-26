import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@solana/web3.js/")) return "solana-web3";
          if (
            id.includes("/node_modules/@solana/wallet-adapter-") ||
            id.includes("/node_modules/@solana-mobile/") ||
            id.includes("/node_modules/@solflare-wallet/")
          ) return "solana-wallets";
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) return "react-vendor";
        }
      }
    }
  }
});
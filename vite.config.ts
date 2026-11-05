import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    // Imagens pequenas viravam base64 dentro do JS principal — aumentam o
    // pacote que o celular precisa baixar e processar antes de pintar a tela.
    // Como arquivo separado, carregam em paralelo (e com loading="lazy").
    assetsInlineLimit: (filePath: string) =>
      /\.(png|jpe?g|webp|avif|gif)$/i.test(filePath) ? false : undefined,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

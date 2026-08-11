import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Base "./" keeps asset paths relative so `npm run build` output can be opened
// from a file server / static host at any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5188, open: true }
})

import { defineConfig } from "vite";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// export default defineConfig(({ mode }) => ({
//   server: {
//     // Firebase Phone Auth ke liye browser mein 127.0.0.1:8080 use karein.
//     host: "::",
//     port: 8080,
//     allowedHosts: [
//       "127.0.0.1",
//       "retainingwall.local",
//       "fencing.local",
//       "decking.local",
//       "landscaping.local",
//     ],
//   },
//   plugins: [react(), mode === "development" && componentTagger()].filter(Boolean) as PluginOption[],
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// }));

export default defineConfig({
  plugins: [react()],
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ["127.0.0.1", "retainingwall.local", "fencing.local", "decking.local", "landscaping.local"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),   // jo pehle se hai
    },
    dedupe: ["react", "react-dom"],            // ← ADD
  },
  optimizeDeps: {                              // ← ADD
    include: ["react", "react-dom", "input-otp"],
  },
});
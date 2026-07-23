// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          // Keep the SSR-safe React runtime out of browser-only vendor chunks.
          // Rolldown otherwise co-locates React with Reactor and Transformers,
          // so importing React evaluates their global-scope initialization in
          // the deployed Worker before a request can be handled.
          manualChunks(id) {
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "react-runtime";
            }

            if (
              id.includes("/node_modules/@reactor-models/") ||
              id.includes("/node_modules/@reactor-team/") ||
              id.includes("/node_modules/@huggingface/") ||
              id.includes("/node_modules/@mediapipe/") ||
              id.includes("/node_modules/@fal-ai/") ||
              id.includes("/node_modules/three/") ||
              id.includes("/node_modules/cuelume/")
            ) {
              return "browser-runtime";
            }
          },
        },
      },
    },
  },
});

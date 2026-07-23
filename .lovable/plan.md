## Root cause

Every route on the deployed site returns 500 with:

```
Error: Disallowed operation called within global scope.
```

Cloudflare Workers forbid I/O, timers, and `crypto.getRandomValues()` during module init. The culprit is `@huggingface/transformers` (used by `src/lib/zap/depth-engine.ts` for the Depth toggle). Its bundled ONNX Runtime Web runs `Ve()` / `wasmBackend` initialization at module top-level, which trips the Worker global-scope check.

Even though `depth-engine.ts` uses `await import("@huggingface/transformers")` inside a function, `src/routes/index.tsx` still statically imports `DepthEngine`, so Vite/Rollup pulls the transformers module into the SSR bundle. Confirmed in the build output: `dist/server/_libs/@huggingface/transformers+[...].mjs` is statically imported by `routes-M7P16K1C.mjs`, `LiquidEther-CFCQ33NI.mjs`, and `sfx-4yT4TVlX.mjs` (Rollup collocated the unenv `performance` polyfill into the same chunk). Once that chunk loads at worker cold-start, ONNX's module-init runs and the Worker rejects it → 500 on `/`, `/discover`, `/favicon.ico`, everything.

The `React.lazy` on HappyOysterApp from the previous turn was correct but not sufficient — transformers is a separate offender.

## Fix

Keep `depth-engine.ts` (and its transitive transformers bundle) out of every SSR-reachable module graph.

1. In `src/routes/index.tsx`:
   - Remove `import { DepthEngine, WebGPUUnsupportedError } from "@/lib/zap/depth-engine"`.
   - Load the module dynamically only in the browser, e.g. inside a `useEffect` / handler:
     ```ts
     const { DepthEngine, WebGPUUnsupportedError } = await import("@/lib/zap/depth-engine");
     ```
   - The `depthAvailable` initial state currently calls `DepthEngine.webgpuAvailable()` in a `useState` initializer — replace with a lightweight inline check (`typeof navigator !== "undefined" && "gpu" in navigator`) and refine after the dynamic import resolves. Keep the ref typed as `unknown` / `any` or import the class as a `type` only (`import type { DepthEngine } from "..."` — type-only imports are erased and don't reach Rollup's SSR graph).
2. Verify the fix with `bun run build` and confirm:
   - `dist/server/_libs/@huggingface/` no longer exists (or is only referenced from client-side async chunks under `dist/client/`).
   - `dist/server/_ssr/*.mjs` no longer statically imports `transformers+[...].mjs`.
3. Publish and hit `https://live.5-dee.com/` — expect 200 with the landing page HTML.

## Out of scope

No behavior changes to the Depth feature itself — the runtime path is the same, only the import boundary moves. UI, presets, streaming, and voice are unchanged.

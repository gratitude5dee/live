## Root cause
The published Cloudflare Worker throws `Disallowed operation called within global scope` while SSR-rendering the app. Something in the module-init chain of `/`, `/library`, or `/remote/$sessionId` calls a forbidden top-level operation (timer, random, fetch, WebSocket…). The build succeeds — this only shows up at runtime on Workers, so `vite dev` looks healthy while every published request 500s and falls back to the branded error page.

The offending code lives deep inside browser-only dependencies (three, mediapipe, fal client, @huggingface/transformers, reactor SDK, voice-agent, WebRTC transport). The whole Zap app is a WebRTC/webcam/WebGPU experience that never renders anything useful on the server anyway.

## Fix (minimal, no business-logic changes)
Disable SSR for the three routes that pull browser-only code, matching what `/discover` already does:

1. `src/routes/index.tsx` — add `ssr: false` to the route options.
2. `src/routes/library.tsx` — add `ssr: false`.
3. `src/routes/remote.$sessionId.tsx` — add `ssr: false`.

`__root.tsx` stays server-rendered so `<head>` metadata/OG tags are still emitted at request time. `/api/reactor/token` and other server functions are unaffected.

## Verify
- `bun run build` still succeeds.
- Fetch `https://zaplive.lovable.app/` and confirm the HTML body is no longer the empty React error placeholder.
- Load `/`, `/library`, `/discover` in the preview — pages render normally, no "This page didn't load" fallback.
- Server logs no longer show the `Disallowed operation` error.

## Not doing
- Hunting the specific module doing the top-level side effect. It's inside third-party deps we can't easily patch, and the routes are client-only by design — `ssr:false` is the documented fix.
- Any UI, styling, or feature changes.
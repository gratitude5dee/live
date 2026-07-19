## Problem

1. When Depth is toggled on:
   - The Lucy playback stays stuck on the previous (raw-camera) look because we swap in the depth `MediaStreamTrack` before its canvas has produced its first real frame. Lucy either receives a black/empty stream or hangs on the last raw frame.
   - The DepthVideo overlay is mounted in the PiP but `srcObject` is attached before the depth canvas has painted anything, and the `<video>` element autoplay can silently stall, so the user still sees the raw camera underneath with landmarks on top.
2. `/library` is a plain dark grid — it doesn't share any visual language with the landing hero (LiquidEther bg, glass surfaces, ShinyText, WZRD logo/nav).

## Fixes

### 1. Depth: wait for first real frame before hot-swap + guarantee playback

In `src/lib/zap/depth-engine.ts`:
- Add a `firstFrame: Promise<void>` that resolves the first time `paintDepth` writes real pixels (not the initial black seed).
- Expose `waitForFirstFrame()` returning that promise.

In `src/routes/index.tsx` `toggleDepth`:
- After `engine.attach(src)`, `await engine.waitForFirstFrame()` (with a 4s timeout fallback) before setting `depthOnRef=true`, `setDepthStream(engine.stream)`, and calling `syncOutboundSource()`.
- Keep `depthLoading` true across the whole wait so the UI shows a spinner/progress.
- On failure or timeout, tear the engine down and surface a toast; do not swap the outbound track.

### 2. Depth PiP visibility

In `DesktopStage.tsx` and `MobileStage.tsx` `DepthVideo`:
- Keep the depth `<video>` overlay, but stack it above the raw camera (`z-10`) and give the raw camera `-z-0`, so when depth is on the user only sees the depth map.
- Hide the raw camera element (`hidden` via conditional class) when `p.depthOn && p.depthStream` — this also stops the mirror-drawn raw frames from bleeding through.
- Add `onLoadedMetadata` handler that explicitly `.play()`s the depth video (some browsers stall until a user gesture even for muted).
- Move the landmark overlay `<canvas>` to only render when the active preset kind actually uses landmarks (character_swap / gesture_fx), so the depth map isn't covered by face wires.

### 3. /library redesign

Rewrite `src/routes/library.tsx` to mirror the landing hero surface:
- LiquidEther background (same colors as hero) behind a translucent content layer.
- Top bar identical to hero: WZRD logo left, BubbleMenu-style nav on the right (or a simpler glass pill nav with "Stage", "Presets", "wzrd.tech").
- `ShinyText` for the page title "Library" and empty-state copy.
- Content grid wrapped in `GlassSurface` cards, one per take:
  - Video/image preview at top with rounded corners, poster fallback, controls.
  - Meta row: kind chip, timestamp, session id short hash, prompt (if we have it via `takes.metadata`) truncated.
  - Actions row: Download (creates an `<a download>` from the signed URL) and Delete with a confirm.
- Fetch every take the current authenticated user can read (existing RLS-scoped query) and generate signed URLs; also fetch `takes.kind = 'video'` first, then images. Add a simple filter pill row: All / Videos / Snapshots.
- Empty state uses the same GlassSurface + ShinyText, with a CTA "← Back to Stage".
- Site footer (`SiteFooter`) reused at the bottom for brand parity.

No schema or storage changes.

## Technical notes

- `depth-engine.ts` only needs one small addition; keeping the seeded-black start avoids a WebRTC "no-source" error, but the `firstFrame` promise is what gates the outbound swap so Lucy sees a real depth image on the very first delivered frame.
- The `<video>` element for the depth stream must be `muted playsInline autoPlay` (already) and we call `.play()` in `onLoadedMetadata` to defeat Safari's occasional stall.
- Library redesign is purely presentational; no server-function or DB migration work.

## Files touched

- `src/lib/zap/depth-engine.ts` — add `firstFrame` promise + `waitForFirstFrame()`.
- `src/routes/index.tsx` — `toggleDepth` awaits first frame; only then swap track and flip UI state.
- `src/components/zap/stage/DesktopStage.tsx` — z-stacking, hide raw when depth on, gated landmark canvas.
- `src/components/zap/stage/MobileStage.tsx` — same as above.
- `src/routes/library.tsx` — full redesign matching hero aesthetic.

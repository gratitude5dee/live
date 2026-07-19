
## What's actually happening

I traced both symptoms to wiring in `src/routes/index.tsx`, `src/lib/zap/composite-stream.ts`, and the two stage views.

**1. Mobile playback quality / proportions**

- `startSession()` builds a `CompositeStream` (1080×1920 canvas re-encode at 30 fps) **eagerly**, right after camera start, even for "clean camera" presets. On mobile Safari the extra canvas draw + `captureStream` chews CPU and heats the device, and any time a Character-Swap / Gesture-FX preset gets pre-selected from the landing wheel we hot-swap Lucy over to that re-encoded track — that's the visibly softer feed.
- `getUserMedia` requests `width 1080 / height 1920 / aspectRatio 9:16`. iOS Safari commonly downgrades to ~480p when it can't satisfy that exact combo, and Android front cams often return landscape frames that then get letter-boxed by the compositor's center-crop. The result is the "off-proportion, blurry" feed the user sees.
- The mobile PiP forces the raw video into an 80×112 box with `object-cover -scale-x-100`, which mis-crops rear-camera (`facingMode: environment`) shots.

**2. Depth toggle doesn't appear to do anything**

- `toggleDepth()` only calls `syncOutboundSource()` — it swaps the WebRTC track sent to Lucy but never changes the on-screen PiP, which still shows `inputStreamRef` (raw camera). The user has no visual confirmation the depth map is active, and Lucy's remapped output looks similar enough at a glance that it reads as "not working".
- On mobile Safari (< iOS 26), `navigator.gpu` is undefined, so `depthAvailable` is `false` and the button is silently disabled with no explanation.

## Changes

All frontend only. Business logic (Supabase, fal transport, prompt engine) is untouched.

### A. Make the depth stream visible in the camera PiP

`src/components/zap/stage/types.ts`
- Add `depthStream: MediaStream | null` to `StageViewProps`.

`src/routes/index.tsx`
- Track `depthStream` state; set it when `DepthEngine` initializes, clear on stop. Pass down to both stages.

`src/components/zap/stage/DesktopStage.tsx` and `MobileStage.tsx`
- In the camera PiP, render a second `<video>` layered over the raw camera video, `srcObject = depthStream`, only visible when `depthOn`. This is the same feed being sent to Lucy, so what you see == what Lucy gets.
- Change the "D" pill to a fuller "Depth" label with three states: `unavailable` (tooltip: "WebGPU required — open in Chrome/Edge desktop"), `loading NN%`, `on`.
- Small "Sending: raw / composite / depth" badge in the PiP corner so mobile users can confirm the outbound source without guessing.

### B. Cut the compositor out of the "clean camera" path on mobile

`src/routes/index.tsx`
- Delete the eager `new CompositeStream(...)` in `startSession()`.
- Build the compositor lazily inside `syncOutboundSource()`, only when `activePresetKindRef.current` is `character_swap` or `gesture_fx`. Dispose it (and null the ref) when swapping back to `"other"` or when depth turns on. This means clean-camera presets and freeform prompts always send the raw `MediaStreamTrack` from `getUserMedia` — no canvas re-encode.

### C. Fix mobile capture constraints and PiP framing

`src/routes/index.tsx`
- Rewrite `getUserMedia` constraints to be iOS-friendly:
  - Drop the `aspectRatio` hint.
  - Use `{ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode }` on mobile (native portrait framing kicks in automatically), and `{ width: { ideal: 1920 }, height: { ideal: 1080 } }` on desktop. Detect via `useIsMobile`'s underlying media query at start time.
- After `getUserMedia`, read the actual track settings and, if the phone gave us a landscape frame with a front camera, rotate the compositor's target aspect to match rather than center-cropping.

`src/components/zap/stage/MobileStage.tsx`
- Enlarge the PiP to a portrait `w-24 h-32` and use `object-contain` when `facingMode === "environment"` so the rear-camera frame isn't cropped weirdly.
- Add the depth overlay described in (A).

### D. Small hardening

`src/lib/zap/composite-stream.ts`
- Add a `dispose()` alias for `stop()` and null out the source ref so the lazy re-create in (B) doesn't leak.

`src/routes/index.tsx` (`stopSession`)
- Ensure compositor and depth engine are disposed and `syncOutboundSource()` is called with a null active preset so the sender doesn't hold a dead canvas track.

## Verification

- Load `/` on desktop Chrome, click "Zap Live", pick a **freeform prompt** — PiP badge reads `raw`, Lucy playback should be visibly sharper than before (no re-encode).
- Pick **YE** (character_swap) — badge flips to `composite`, face landmarks bake in.
- Toggle **Depth** — PiP swaps to the grayscale depth map, badge reads `depth`, Lucy repaints from the depth stream.
- Load on iPhone Safari — camera comes up in native portrait, PiP shows correct crop, "Depth" pill is greyed with the tooltip.

## Out of scope

- No changes to fal transport, Supabase schema, prompt templates, or landing page.
- Not migrating depth to a mobile-friendly backend (would require a WASM/CPU fallback pipeline — separate follow-up).

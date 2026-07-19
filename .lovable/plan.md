## Goal
Feed Lucy a composited video stream that bakes the MediaPipe hand + face landmarks into every frame, instead of the raw webcam/phone-cam feed.

## Current state (verified)
- `src/routes/index.tsx:510` stores raw `getUserMedia` stream in `inputStreamRef`.
- `src/lib/zap/fal-transport.ts:70` adds `inputStream.getVideoTracks()` directly to the RTCPeerConnection — Lucy sees the untouched webcam.
- `drawHandOverlay` / `drawFaceOverlay` render only to the visible PiP `overlayRef` canvas (`src/routes/index.tsx:736-737`).

## Design: a compositor canvas

Create a hidden `<canvas>` (the "compositor") that runs an rAF loop:
1. Match the camera track's native resolution (e.g. 720×1280 portrait) so Lucy receives full-quality frames.
2. Each frame: `drawImage(inputVideoElement)` → `drawHandOverlay(ctx, lastGestureResult, hold)` → `drawFaceOverlay(ctx, faceEngine.lastResult)`.
3. `compositorCanvas.captureStream(30)` produces a `MediaStream` whose video track carries the composited output.

Pass this composited stream (not the raw one) to `FalTransport`. The raw `inputStreamRef` remains alive and attached to the visible camera `<video>` so MediaPipe engines keep reading pixels from it.

## Changes

### 1. `src/lib/zap/composite-stream.ts` (new, ~60 LOC)
Small helper class:
- `constructor(sourceVideo: HTMLVideoElement, draw: (ctx, w, h) => void, fps = 30)`
- Creates an offscreen canvas sized from `sourceVideo.videoWidth/Height` (re-syncs on `loadedmetadata` / resize).
- Runs rAF loop drawing video then invoking `draw` callback for overlays.
- `stream: MediaStream` from `canvas.captureStream(fps)`.
- `stop()` cancels rAF and stops the captured tracks.

### 2. `src/routes/index.tsx`
- Add `compositorRef = useRef<CompositeStream | null>(null)` and a hidden `<video>` element ref used purely as the compositor's pixel source (attached to `inputStreamRef.current`).
- After acquiring the camera and before starting `FalTransport`:
  - Instantiate `CompositeStream(hiddenVideo, (ctx, w, h) => { drawHandOverlay(ctx, lastGestureResultRef.current, lastHoldRef.current, { width: w, height: h }); drawFaceOverlay(ctx, faceEngineRef.current?.lastResult ?? null, { width: w, height: h }); })`.
  - Pass `compositor.stream` into `new FalTransport(...)` instead of `inputStreamRef.current`.
- On `stopSession`: `compositor.stop()` and null the ref (before stopping raw camera tracks).
- Existing PiP overlay canvas stays as-is (nice for local UI feedback).

### 3. `src/lib/zap/overlay.ts`
- Extend `drawHandOverlay` / `drawFaceOverlay` to accept an optional `{ width, height }` so the compositor can pass its canvas dims (the current impl reads `ctx.canvas.width/height` — verify; if it already does, no change needed).

### 4. `src/lib/zap/fal-transport.ts`
- No API change. It still receives a `MediaStream` and adds its video tracks; the source just happens to be the composited canvas track.

## Nothing else changes
- MediaPipe pipelines, presets, recording (recorder already captures the Lucy *output*), transport signaling, UI layout: untouched.
- Fallback: if composite fails to init, we log and fall back to the raw stream so the session still connects.

## Technical notes
- `canvas.captureStream(30)` is well-supported in Chromium/Safari/Firefox.
- Compositor rAF runs at display refresh; we throttle via `if (now - last < 1000/30) return;` to cap at ~30 fps and keep GPU cost low.
- No added end-to-end latency of note: draw ops are trivial (few hundred landmark points), well under one frame.
- Landmarks are drawn mirrored the same way the PiP renders them (source video already mirrored visually only via CSS — the composited canvas uses unmirrored pixels so Lucy sees a natural, non-mirrored view; overlays follow the same coordinate space MediaPipe returns).

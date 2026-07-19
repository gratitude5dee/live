## Assumption

You didn't paste a specific stack trace, so I'm reading "streaming errors" as the class of issues we've been hitting on the Lucy pipeline (blurry / stalled output, occasional 422 / signaling races, PiP not populating). If there's a specific error string in your console right now, paste it and I'll narrow the plan.

## Part 1 — Streaming scan & fixes

Targeted pass across `src/routes/index.tsx`, `src/lib/zap/fal-transport.ts`, and `src/lib/zap/composite-stream.ts`:

1. **Track-swap safety** (`fal-transport.ts`)
   - `replaceVideoTrack` is called before `videoSender` exists on early preset selection. Guard the pre-connect case by queuing the desired track and applying it once `pc.addTrack` runs.
   - When swapping to a canvas track, set `contentHint = "detail"` on the outbound track so the encoder favors sharpness over motion smoothing.

2. **Compositor start ordering** (`routes/index.tsx`)
   - The compositor is built after `getUserMedia` but the `inputVideoRef` may not have attached yet on first paint (callback ref races the `startSession` flow). Await `inputVideoRef.current` via a small `waitForRef` before constructing `CompositeStream`; today it can silently fall back to "clean camera only".
   - On `stopSession`, stop the compositor + all tracks before nulling refs (currently order-dependent → occasional "InvalidStateError: sender removed").

3. **WebRTC signaling** (`fal-transport.ts`)
   - Buffer ICE candidates generated before `setRemoteDescription` completes; today they fire into `connection.send` before Lucy's answer is applied, which the server ignores → longer connect times.
   - Add a single `pc.close()` guard in `onError` so a failed handshake doesn't leak a peer connection that keeps sending candidates.

4. **Token mint** (`fal-token.functions.ts`)
   - Duration is 120s but the client only refreshes on reconnect. Keep 120s but surface a specific error string when 422 recurs so it stops being swallowed as a generic "connecting" state.

5. **Recording resilience** (`routes/index.tsx`)
   - MediaRecorder currently starts on `onOutputStream`. If the output track ends mid-recording (Lucy hiccup), the blob is truncated with no user feedback. Add an `onended` handler that finalizes the current take and prompts a re-arm.

No schema, no UI changes for Part 1.

## Part 2 — Depth toggle (WebGPU + Transformers.js → Lucy)

### UX
- Add a small pill button labeled **"Depth"** to the top-right of the camera PiP card in both `DesktopStage.tsx` and `MobileStage.tsx`.
- States: `off` (default, ghost border), `loading` (spinner while the model warms up), `on` (solid accent, live).
- When `on`, the outbound Lucy track becomes the depth-map canvas; when `off`, we revert to the current preset-driven source (raw camera or MediaPipe composite).
- Disabled with a tooltip on browsers without `navigator.gpu`.

### Pipeline
- Package: `@huggingface/transformers` (installed via `bun add`).
- Model: `onnx-community/depth-anything-v2-small` on `device: "webgpu"`, `dtype: "fp16"` — matches the referenced Xenova space and runs ~30 FPS on discrete GPUs, ~10–15 on integrated.
- Warm-up happens on first toggle; the button shows a progress percentage from the `progress_callback` so the user sees model-download state.

### New module: `src/lib/zap/depth-engine.ts`
- Class `DepthEngine` with:
  - `init()` — lazy-loads the pipeline; feature-detects `navigator.gpu`, throws a typed `WebGPUUnsupportedError` otherwise.
  - `attach(sourceVideo, { fps = 24, targetAspect = 9/16, targetHeight = 1920 })` — creates a hidden canvas, runs a rAF loop that grabs a downscaled RawImage (e.g. 384×384) from the video, runs the depth pipeline, and blits the normalized depth (grayscale, near = white) upscaled + center-cropped onto the output canvas.
  - `stream: MediaStream` — via `canvas.captureStream(fps)`.
  - `stop()` — cancels rAF, stops tracks, disposes tensors.
- Uses an in-flight guard so we never queue overlapping inferences (drops frames instead of stacking latency).

### New source kind in `routes/index.tsx`
- Add `"depth"` to the outbound-source selection alongside `"other" | "character_swap" | "gesture_fx"`.
- `syncOutboundSource()` picks the depth canvas track when `depthOn` is true, regardless of active preset kind.
- On toggle-on: init engine, hot-swap track via `transport.replaceVideoTrack(depthEngine.stream.getVideoTracks()[0])`, and append a small prompt hint (e.g. "Interpret the input as a depth map; treat brighter regions as closer to camera.") to whatever preset prompt is active, so Lucy uses the depth cue instead of trying to render literal grayscale. On toggle-off: restore previous prompt and revert the track.

### PiP overlay
- When Depth is `on`, also render a tiny depth-map preview inside the PiP (bottom-right corner) so the user can see what Lucy is receiving.

### Files touched
- `src/lib/zap/fal-transport.ts` — track-swap queueing, ICE buffering, close guard, `contentHint`.
- `src/lib/zap/composite-stream.ts` — no changes expected.
- `src/routes/index.tsx` — `depthOn` state, engine wiring, prompt augmentation, source selection.
- `src/components/zap/stage/types.ts` — add `depthOn`, `depthLoading`, `toggleDepth` to `StageViewProps`.
- `src/components/zap/stage/DesktopStage.tsx` + `MobileStage.tsx` — Depth pill on the PiP.
- **New** `src/lib/zap/depth-engine.ts`.
- `package.json` — `@huggingface/transformers`.

### Deployment note
Transformers.js runs entirely in-browser (WebGPU + WASM fallback) and downloads the ONNX weights from the HF CDN on first use — no server functions, no new secrets.

## Out of scope
- Falling back to WASM depth if WebGPU is missing (button is simply disabled, matching the reference space).
- Fine-tuning the "depth" preset — we ship a sensible default prompt and let the user layer their own on top.

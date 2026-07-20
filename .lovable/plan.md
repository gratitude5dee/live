# Mobile Latency & Correctness Pass

Ships the 8 fixes from the audit. Grouped by file so each edit is small and reviewable.

## 1. iOS recording — never throw, pick a supported mime (`src/routes/index.tsx`)

- In `startRecording`, probe candidates in order: `video/mp4;codecs=avc1.64001f,mp4a.40.2`, `video/mp4`, `video/webm;codecs=vp9`, `video/webm;codecs=vp8`, `video/webm`.
- If none supported → toast + bail (don't construct).
- Wrap `new MediaRecorder(...)` in try/catch; the auto-record `setTimeout` path also gets a try/catch so a failed init can't crash the session.
- Thread the chosen `mimeType` through `chunksRef`/upload. Derive extension (`mp4`/`webm`) from mime in `uploadTake` and in the Download chip filename.

## 2. Reference images ride as URLs, not base64 (`src/routes/index.tsx`, `fal-transport.ts`)

- After a successful `refs`-bucket upload, resolve a URL via `supabase.storage.from("refs").createSignedUrl(path, 3600)` (fallback `getPublicUrl`) and store it on `refImage` as `{ url, path, dataUri? }`.
- `applyPrompt` / `undo` / reactive-revert pass `reference_image_url = ref.url ?? ref.dataUri` — data URI kept only as fallback when upload failed.
- Preset ref cache (`loadPresetRef`) prefers the remote URL directly (they already live at public URLs); skip the FileReader base64 step.
- `PromptState` gains `refUrl` alongside `refImage` so `flushPrompt()` re-sends the URL on reconnect.

## 3. WebRTC sender tuning (`src/lib/zap/fal-transport.ts`)

- After `pc.addTrack` in `beginWebRTC`, set on the video sender:
  - `params.degradationPreference = "maintain-framerate"`
  - `params.encodings = [{ maxBitrate: 2_000_000, maxFramerate: 30 }]`
- Change `replaceVideoTrack` `contentHint`: `"motion"` for raw/composite camera tracks, `"detail"` only for the depth track. Callers pass a `kind` hint; default `"motion"`.
- Add lightweight `getStats()` poll (2 s) exposing `qualityLimitationReason` via a callback → surfaced in the perf chip.

## 4. Warm-start MediaPipe + fal token (`LandingHero.tsx`, `src/lib/zap/mediapipe.ts`, `src/routes/index.tsx`)

- Add module-level `warmVision()` in `mediapipe.ts` that memoizes `Promise.all([loadGestureRecognizer(), loadFaceLandmarker()])`.
- Kick it off on `LandingHero` mount (idle callback) and on first pointerdown of the Enter CTA.
- Pre-mint `mintFalRealtimeToken({ app: "decart/lucy-2-5/realtime" })` on Enter pointerdown; stash promise on a ref; `startSession` awaits both.
- Follow-up (documented, not required this PR): self-host `.task` models + wasm under `/public/mediapipe/` with immutable cache headers. Left as TODO comment referencing this plan.

## 5. Right-size the PiP overlay (`src/routes/index.tsx` inference loop)

- Size overlay canvas to `el.clientWidth * dpr` × `el.clientHeight * dpr` (recompute on ResizeObserver).
- Skip the `drawImage(video, ...)` blit entirely when `showPip === false` or `hudVisible === false`.
- Clear+draw only overlays that are actually visible.

## 6. Time-based cadence (`src/routes/index.tsx`, `src/lib/zap/gesture-engine.ts`)

- Replace frame-counter throttles with wall-clock: `if (now - lastGestureAt >= 66) run…`, `if (now - lastFaceAt >= 133) run…`.
- Prefer `video.requestVideoFrameCallback` when available; fall back to `rAF`.
- `GestureEngine`: swap `REQUIRED_FRAMES` for `REQUIRED_MS` (~200 ms streak, ~800 ms Open-Palm hold as today). Store `streakStartMs` instead of a frame count.

## 7. Preset prompts skip expansion (schema + UI)

- Migration: `ALTER TABLE public.presets ADD COLUMN expand boolean NOT NULL DEFAULT false;` (existing rows default to false — presets already follow the Lucy guide). Freeform text keeps `enable_prompt_expansion = enhance`.
- `applyPrompt` uses `enable_prompt_expansion = source === "voice" ? false : source === "preset" ? preset.expand : enhance`. Preset is threaded via a new optional arg.

## 8. Misc mobile

- `useIsMobile`: initialize synchronously from `matchMedia` with an SSR guard so the first paint mounts the correct stage (no Desktop→Mobile remount tearing video refs).
- iOS keyboard: in `DesktopStage`/`MobileStage` prompt dock, subscribe to `visualViewport.resize` and set `translateY(-(innerHeight - visualViewport.height))` on the dock.
- Mobile removes the auto `a.click()` in `uploadTake`; the Download chip is the only mobile path (desktop keeps auto-download behavior gated on `!isMobile`).
- Depth availability: replace `"gpu" in navigator` with `await navigator.gpu?.requestAdapter()` on first Enter, memoized. If unavailable but `navigator.gpu` exists, offer the `DepthEngine` in `wasm` / `q8` / `inputSize:256` mode as a graceful fallback (new `DepthEngine` opts).

## Technical notes

- No changes to Supabase schema besides the additive `presets.expand` column + grant unchanged (existing grants cover it).
- `VideoTransport.replaceVideoTrack(track, { kind })` — additive optional arg, backward compatible.
- `PromptState.refUrl` — additive optional field; existing consumers keep working with `refImage` (data URI) fallback.
- No new dependencies.

## Out of scope (call out but don't ship)

- Self-hosting MediaPipe wasm/models under `/public` (leave TODO).
- `getStats()` overlay UI polish beyond the existing perf chip.

# MediaPipe / Depth → Lucy realtime — implementation plan

Scope covers all 7 items you flagged. Grouped by risk / surface area so we can ship in one build pass without destabilizing the live loop.

## Group A — spatial control (4.1)

**Goal:** turn the index fingertip into a placement channel for add/template prompts, with no new Lucy API surface.

- New `src/lib/zap/describe-region.ts`
  - `describeRegion(x, y): { zone, phrase }` — 3×3 grid over normalized 0..1 coords, returns tokens like `"upper-left"`, `"center"`, `"lower-right"` plus a natural-language fragment (`"at the upper left of the frame"`).
- `src/lib/zap/gesture-engine.ts`
  - Expose the latest `pointingTip` (hand[8] of the highest-scoring hand, only while `Pointing_Up` is the top gesture above the confidence floor). No behavior change to fire cooldown/streak.
- `src/routes/index.tsx` — `applyPrompt` path
  - When the pending prompt came from a template (`kind: "object_add" | "object_replace" | "try_on"`) OR contains a `{{where}}` placeholder, and `pointingTip` is fresh (<400 ms), append the region phrase.
  - Voice path (`voice-intent.ts` add/replace intents): same fusion — `describeRegion(tip)` fragment gets injected before send. This is what makes "Computah, put a plant there" work.
- `src/lib/zap/prompt-templates.ts`
  - Add optional `{{where}}` slot in the three placement-friendly templates so fusion is explicit, not a string append.

## Group B — depth as a first-class preset surface (4.2, 4.7)

- Schema: add `input_hint text` to `presets` (nullable; `'depth' | 'raw' | null`). Grants unchanged.
- Migration seeds 5 depth-tagged presets: `liquid chrome figure`, `hologram wireframe`, `thermal camera`, `nebula silhouette`, `topographic map`. No image refs; text-only prompts tuned for structure-only input.
- `src/routes/index.tsx` `applyPreset`
  - If `preset.input_hint === 'depth'` and depth is off → call `toggleDepth()` first, `await depthEngine.waitForFirstFrame()`, then send prompt. If WebGPU unavailable, toast a graceful fallback and send prompt against the raw feed.
  - When switching to a non-depth preset, leave depth as-is (user toggle wins).
- Preset rail (`DesktopStage.tsx`, `MobileStage.tsx`): small "DEPTH" chip badge on depth-tagged presets so the behavior is discoverable.
- 4.7 presence + visibility pause for `DepthEngine`
  - Add `pause()/resume()` to `DepthEngine`; loop early-returns when paused.
  - `FaceEngine.onFacePresence(false)` → `depth.pause()`; `true` → `depth.resume()`.
  - `document.visibilitychange` (via existing `use-page-active` hook) → same.

## Group C — depth engine perf + stability (4.3, 4.4)

`src/lib/zap/depth-engine.ts`:

- **Buffer reuse (4.3, main-thread pass first).** Hoist to instance fields: `paintTmpCanvas`, `paintTmpCtx`, `paintImageData` sized to model output (H×W). Reallocate only when dims change. Removes per-frame `new ImageData` + `document.createElement('canvas')`.
- **Subsampled min/max.** Scan every 4th pixel for `min`/`max` (visually identical, ~4× cheaper). Normalization loop unchanged.
- **Temporal EMA (4.4).** Instance `emaMin`, `emaMax` (init `null`). Each frame: `emaMin = 0.9*prev + 0.1*newMin` (same for max). Use EMA range for normalization; reset EMA on `pause()`. Kills global brightness flicker when someone crosses the background.
- **Worker + OffscreenCanvas (4.3, phase 2).** New `src/lib/zap/depth-worker.ts`:
  - Owns the transformers.js pipeline and the output canvas via `OffscreenCanvas.transferControlToOffscreen()`.
  - Main thread posts `createImageBitmap(video)` each tick; worker runs inference + paint. `firstFrame` promise resolves via `postMessage`.
  - Progress callback proxied through `postMessage` so the existing HUD download progress still works.
  - Falls back to the current main-thread path if `OffscreenCanvas` or worker-module support is missing (older Safari).

Verification: FPS counter on the depth stream stays ≥20 while MediaPipe + compositor + Lucy WebRTC are all live; no visible pumping when someone walks in/out of frame.

## Group D — landmark bake hygiene (4.5)

`src/lib/zap/overlay.ts` — add minimalist variants used only for the baked compositor path (PiP HUD keeps today's full skeleton/mesh):

- `drawFaceOvalOnly(ctx, result, rect, { alpha: 0.15 })` — face oval connectors only, thin white.
- `drawFingertipDots(ctx, result, rect, { alpha: 0.6 })` — dots on indices `[4, 8, 12, 16, 20]`, no bones.

`src/lib/zap/composite-stream.ts` (bake path used when `bakeLandmarks` is on):

- Route by active template kind:
  - `character_swap` → `drawFaceOvalOnly` only.
  - `gesture_fx` (and anything pointing-driven) → `drawFingertipDots` only.
  - Otherwise → no bake (clean frame).

Keeps Lucy's RGB input from ingesting cyan tessellation lines. PiP overlay code is untouched.

## Group E — more blendshape triggers (4.6)

`src/lib/zap/face-engine.ts`:

- Extend `Trigger` with optional `combine?: (bs) => number` so multi-blendshape triggers can compose scores (average of left+right, or diff for double-blink).
- New triggers, all sharing the existing 6 s global cooldown:
  - `smile` — `(mouthSmileLeft + mouthSmileRight)/2 > 0.7`, 500 ms hold → action `"golden_hour"`.
  - `double_blink` — both `eyeBlinkLeft/Right > 0.5` twice within 700 ms → action `"snapshot"`.
  - `head_tilt` — enable `outputFacialTransformationMatrixes: true` on `FaceLandmarker`; derive roll from the 4×4; `|roll| > 15°` held 500 ms → action `"parallax"`.
- `src/routes/index.tsx` action map:
  - `golden_hour` → append `", golden hour lighting, warm rim light"` to current applied prompt (transient, 6 s auto-revert like existing reactive effects).
  - `snapshot` → existing snapshot handler (already wired for gesture `Closed_Fist`).
  - `parallax` → subtle scene-parallax prompt fragment, same transient pattern.

## Files touched

New:
- `src/lib/zap/describe-region.ts`
- `src/lib/zap/depth-worker.ts`
- One migration: `presets.input_hint` + 5 depth preset rows.

Modified:
- `src/lib/zap/gesture-engine.ts` (expose pointing tip)
- `src/lib/zap/face-engine.ts` (new triggers, transform matrix)
- `src/lib/zap/depth-engine.ts` (buffer reuse, subsample, EMA, pause/resume, worker delegation + fallback)
- `src/lib/zap/overlay.ts` (minimalist bake helpers)
- `src/lib/zap/composite-stream.ts` (kind-aware bake selection)
- `src/lib/zap/prompt-templates.ts` (`{{where}}` slot)
- `src/lib/zap/voice-intent.ts` (region fusion on add/replace intents)
- `src/routes/index.tsx` (apply-prompt fusion, depth-preset auto-toggle, presence→depth pause, new face actions)
- `src/components/zap/stage/DesktopStage.tsx`, `MobileStage.tsx` (DEPTH badge on preset chips)

Unchanged: fal-transport, voice-agent transport layer, PiP overlay visuals, RLS/grants pattern for presets.

## Verification

- **4.1** With a template armed, point to top-left → applied prompt string contains `"upper left"`; Lucy places the object there. Repeat via "Computah, put a plant there".
- **4.2** Applying `Thermal camera` preset with depth off auto-enables depth, first frame arrives before send; toggling to a raw preset leaves depth as user left it.
- **4.3** Chrome perf profile: `paintDepth` no longer shows GC spikes; with worker path enabled, main-thread scripting during depth ticks drops noticeably.
- **4.4** Walk across background — output depth video brightness stays stable.
- **4.5** Bake on with `character_swap`: Lucy output no longer shows cyan mesh contamination; oval-only guides still steer identity.
- **4.6** Smile → warm relight; double-blink → snapshot fires; head-tilt → parallax fragment appears in applied prompt. Cooldown prevents overlap.
- **4.7** Cover camera 3 s → depth engine `inFlight`/`raf` stop; uncover → resumes within one frame. Backgrounding the tab pauses too.

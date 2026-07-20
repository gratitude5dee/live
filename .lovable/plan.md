## Fixes

### 1. Spatial fusion (`describeRegion` never fires)
`GestureEngine.pointingTip` only updates when MediaPipe's top gesture is `Pointing_Up` / `Open_Palm` above 0.7 confidence. In practice, casual pointing rarely classifies as `Pointing_Up` (needs index up + others curled), so the tip stays `null` and `applyPrompt`'s tipFresh check never passes — `{{where}}` and "there/here" fusion silently no-op.

Change `src/lib/zap/gesture-engine.ts`:
- Always read the index-fingertip landmark (`landmarks[handIdx][8]`) from the highest-scoring hand whenever `result.landmarks` is non-empty, regardless of gesture label.
- Additionally track a `pointingActive` boolean that is true only for `Pointing_Up` (used later if we want stricter behavior), but expose `pointingTip` from any detected hand so fusion works for natural pointing.
- Widen freshness window in `src/routes/index.tsx` from 400ms → 800ms (hand can leave frame briefly between "point" and voice/text prompt landing).

### 2. Depth map errors → Lucy
Two real bugs in `src/lib/zap/depth-engine.ts::paintDepth`:

- **No clamp on normalized grayscale.** Because `emaMin`/`emaMax` lag the raw distribution, per-frame values regularly fall outside the EMA window and `Math.round(((d-min)/range)*255)` produces negatives / >255. Written into `Uint8ClampedArray` this wraps visually into black/white noise flashes → Lucy sees garbage structure. Clamp `g` to `0..255`.
- **EMA can invert.** When the scene changes fast (someone steps in) `emaMax` can transiently be `≤ emaMin`, making `range ≤ 0` and painting a flat frame. Guard: `range = Math.max(emaMax - emaMin, 1e-4)`; if `emaMax <= emaMin`, snap both to the raw values that frame instead of blending.
- **Slow EMA warmup.** First few frames use raw min/max (already correct) but subsequent frames blend at α=0.1 — too slow after a real scene change. Bump α to 0.25 and reset EMA whenever raw range differs from EMA range by >2×.

Rendering issue: the depth `<canvas>` is created at 720×1280 (portrait) but Lucy's WebRTC track expects the sender's declared aspect. When the source camera is landscape 1080p and we hot-swap to a portrait depth stream, the Lucy preview shows letterboxed/stretched output.
- Fix in `DepthEngine` constructor: default `targetAspect` to match the *source video's* actual aspect at `attach()` time (resize canvas on first `tick` if `videoWidth/videoHeight` differs from the assumed aspect). Fall back to 9:16 only when the source is portrait.

### 3. Homepage SFX = one continuous drone
The CTA button carries `data-cuelume-hover="bloom"`. `bloom` is a pad-style sustained cue; combined with the `GlassSurface` SVG-filter overlay + `GhostCursor` layer sitting near the CTA, `pointerenter` re-fires many times per second as pointer capture bounces between stacked layers, producing overlapping bloom pads that sound like one continuous tone.

Changes:
- Remove `data-cuelume-hover="bloom"` from the CTA in `src/components/zap/LandingHero.tsx`. Keep `data-cuelume-press`/`data-cuelume-release` only — clicks are discrete events.
- Remove `data-cuelume-hover="chime"` from the ChooseReality preset cards (`src/components/zap/ChooseReality.tsx`) — those cards animate on mouse-move and re-trigger enters. Keep `press` + `toggle`.
- Add a lightweight throttle in `src/lib/sfx.ts`:
  - Wrap `play()` with a per-sound-name debounce (~180ms) so any residual rapid re-triggers coalesce.
  - Do the same for declarative sounds by installing a capturing `pointerenter` listener that stamps `data-cuelume-*` elements and short-circuits `cuelume`'s replay via a `data-sfx-cooldown` marker (`bind()` is idempotent — safe to keep).
- Sanity: sweep the homepage for any other `data-cuelume-hover` on animated components and downgrade to press/toggle only.

### Verification
- Point at the top-left of the frame, say "Computah, put a plant there" — the Lucy prompt log should show "…at the upper left of the frame".
- Toggle depth on/off during a session — the depth PiP should stay stable in brightness during motion, and Lucy's playback should remain properly framed with no aspect distortion.
- On the homepage, hover the CTA and preset cards — no sustained drone; only discrete press/toggle clicks produce sound.

### Files touched
- `src/lib/zap/gesture-engine.ts`
- `src/lib/zap/depth-engine.ts`
- `src/lib/sfx.ts`
- `src/routes/index.tsx` (freshness window + a note on toggleDepth aspect)
- `src/components/zap/LandingHero.tsx`
- `src/components/zap/ChooseReality.tsx`

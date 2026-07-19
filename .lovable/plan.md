## Goal

Stop baking the MediaPipe **face mesh** into every outbound frame to Lucy. Face landmarks should only be composited when the active preset is a **character-swap** style (where face geometry helps Lucy re-identify the subject). For all other presets (backgrounds, try-on, object add-in, effects like Fire Hands, stylizations), Lucy should receive **hand overlays only** — no face lines. Hand overlays remain always-on since gestures drive edits.

Also fix the composite canvas so its aspect ratio matches the 9:16 output pipeline instead of raw `videoWidth/Height` (which is landscape on most webcams and causes the letterboxed / distorted face proportions visible in Lucy's repaint).

## Changes

### 1. Tag character-swap presets
- In the seed migration / preset rows, add a boolean-ish marker. Simplest: reuse existing `template_key` / `kind` — mark presets whose *intent* is character identity swap with `template_key = 'character_swap'` (or add a new `tags: string[]` column via migration).
- Curated character-swap presets to flag: **Streamer**, **Hooded Windbreaker**, **Leather Vest**, **Pink Stripe Kit** (person-centric identity swaps). Backgrounds (Beach, Neon City, NFL Night, Soccer Daylight), stylizations (Anime, Watercolor, Sketch, Cyberpunk, Clean Studio), and effects (Fire Hands, Crown, Try-On, Object add-in) are **not** character-swap.

### 2. Route active preset kind into the compositor
- `src/routes/index.tsx`: keep a ref `activePresetKindRef` updated whenever `applyPreset` / template dialogs run. Values: `'character_swap' | 'other'`.
- Update the `CompositeStream` draw callback (line 611-622) to only call `drawFaceOverlay(...)` when `activePresetKindRef.current === 'character_swap'`. `drawHandOverlay` still always runs.
- The PiP HUD overlay (line 778-779) keeps drawing both face + hands regardless — that's user-facing feedback and unrelated to Lucy's input.

### 3. Fix compositor proportions (9:16)
- `src/lib/zap/composite-stream.ts`: instead of copying `videoWidth/Height`, lock the canvas to a portrait target (e.g. 720×1280) and draw the source video with `object-cover` math — center-crop the widest dimension so the subject stays framed and the output aspect matches the recording / Lucy 9:16 pipeline.
- Add an optional `targetAspect` constructor arg (default `9/16`) so we can tune without further changes.

### 4. No changes to
- `overlay.ts` drawing routines
- `fal-transport.ts`
- Face engine / gesture engine loops
- Recording pipeline (already 9:16)

## Technical notes

- `activePresetKindRef` avoids re-instantiating the compositor on preset change — the ref is read fresh every frame inside the draw callback.
- Center-crop math: `const scale = Math.max(cw/vw, ch/vh); const dw = vw*scale; const dh = vh*scale; ctx.drawImage(v, (cw-dw)/2, (ch-dh)/2, dw, dh);`
- Migration is idempotent: `UPDATE public.presets SET template_key='character_swap' WHERE name IN (...);` — safe to re-run.

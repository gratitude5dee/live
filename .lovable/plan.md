## Goal
Make the desktop Stage feel cinematic: Lucy's realtime output fills the entire viewport, and the MediaPipe camera PiP is reshaped to comfortably frame face + chest + hands.

## Changes (scoped to `src/components/zap/stage/DesktopStage.tsx`)

### 1. Full-bleed Lucy output
- Promote the Lucy `<video>` to a fixed, full-viewport layer (`fixed inset-0 w-screen h-[100dvh]`) with `object-cover` so it fills the screen edge-to-edge regardless of aspect.
- Drop the current centered 9:16 letterboxed frame in the middle column; the middle column becomes transparent negative space over the video.
- Keep a subtle vignette/gradient overlay at top and bottom so the floating HUD chrome (top bar, preset rail, right HUD stack) stays legible over bright frames.

### 2. Floating HUD chrome
- Convert the left preset rail, top bar (logo + LIVE pill + Library/timer/Stop/Disconnect), and the right column (Camera PiP, Phone Remote QR, Session stats) into floating glass panels layered above the full-bleed video (`fixed` / `absolute` with `z-20`, existing GlassSurface styling preserved).
- No layout logic changes — same components, just repositioned as overlays.

### 3. PiP camera reshaped for face + chest + hands
- Change the PiP camera card from the current wide 16:9-ish crop to a **4:3 portrait-ish frame** (`aspect-[3/4]`, width ~280px on desktop) — this comfortably includes head, shoulders, and raised hands, which is what the MediaPipe hand + face landmarkers need.
- Ensure the `<video>` inside uses `object-cover` and `transform: scaleX(-1)` (mirror) so the operator sees themselves naturally.
- The overlay `<canvas>` (hand/face skeletons) is resized to match the new PiP dimensions via the existing overlay sizing effect — no engine changes.

### 4. Nothing else touched
- Mobile stage untouched.
- No changes to transport, recording, MediaPipe engines, presets logic, or routes.

## Technical notes
- Pure presentation edit in one file (`DesktopStage.tsx`).
- Uses existing `GlassSurface`, existing refs for `outputVideoRef`, `cameraVideoRef`, `overlayCanvasRef`.
- Z-index stack: video (z-0) → gradient overlay (z-10) → HUD panels (z-20) → dialogs/toasts (existing).

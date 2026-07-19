## Problem

1. **Quality regression**: Character-swap presets route through `CompositeStream` (offscreen canvas at 1080×1920, 30fps, `captureStream`) so face landmarks can be baked into the frame. That extra re-encode softens the feed vs. the native `getUserMedia` track — visible in screenshot #1 (`COMPOSITE` badge, muddy skin detail). Gesture-FX ("Fire Hands") is the same path. All other presets already send the raw track and look sharper.
2. **Ref image UX**: The tiny thumbnail next to the ✨Enhance / 🖼️Ref chips (red circle in screenshot #2) is a static `<img>` — no way to replace or delete without opening the file picker + no visible affordance to remove.

## Fix

### A. Default character_swap + gesture_fx to the raw camera track

- In `src/routes/index.tsx`, add a `bakeLandmarksRef` (default `false`) that gates whether Character Swap / Gesture FX use the compositor. When off, `syncOutboundSource` sends `inputStreamRef.current` (raw 1080p track) for *all* preset kinds — matching the "clean camera" path. When on, it uses the compositor as today.
- Expose a small "Landmarks" pill toggle in the camera PiP header (next to `DEPTH`) in both `DesktopStage.tsx` and `MobileStage.tsx`. Hidden unless the active preset kind is `character_swap` or `gesture_fx`. Persist choice in `sessionStorage`.
- Update the `activeSource` badge accordingly (`RAW` becomes the default label after this change).
- Keep the compositor code path intact; just don't spin it up unless the user opts in.

Rationale: Lucy re-identifies from the reference image; baked face wireframes are a nice-to-have, not required, and their cost is a global quality hit users notice more than the identity boost.

### B. Make the ref-image chip directly editable

In `DesktopStage.tsx` (and mirror in `MobileStage.tsx` composer), replace the static thumbnail with a compact control group:

```
[🖼️ Ref]  →  when refImage present:
   ┌────────────┐
   │  thumb  ×  │   ← click thumb = re-open file picker (replace)
   └────────────┘        × button = clear ref
```

- Wrap the thumbnail in a `<label htmlFor="ref-file">` so clicking it re-opens the same hidden `<input type="file">` (replace).
- Add an `×` button overlaid top-right of the thumb that calls a new `clearRefImage` prop.
- Add a `clearRefImage` handler in `src/routes/index.tsx` that sets `refImage` to `null` and re-applies the current prompt without a ref (so Lucy immediately drops the reference).
- Extend `StageViewProps` in `src/components/zap/stage/types.ts` with `clearRefImage: () => void` and the new landmarks toggle props (`bakeLandmarks`, `toggleBakeLandmarks`, `landmarksAvailable`).
- Hide the 🖼️Ref upload chip once a ref is present (the thumbnail becomes the interactive control) to declutter.

### C. Mirror on mobile

Apply the same landmarks toggle + ref chip changes in `MobileStage.tsx` so both surfaces behave identically.

## Files touched

- `src/routes/index.tsx` — add `bakeLandmarksRef` + toggle, update `syncOutboundSource`, add `clearRefImage`, wire new props through to stage views.
- `src/components/zap/stage/types.ts` — new props.
- `src/components/zap/stage/DesktopStage.tsx` — PiP landmarks toggle, replace ref thumbnail with replace/remove control.
- `src/components/zap/stage/MobileStage.tsx` — same two changes.

No schema, transport, or fal-token changes.

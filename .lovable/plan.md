# Fix: MediaPipe overlay misaligned in camera PiP

## Diagnosis (confirmed)

The overlay canvas is doing two things wrong, both visible in the screenshot where the face mesh floats off the face and the hand skeleton drifts down-left of the actual hand:

1. **Wrong coordinate space.** `runInferenceLoop` in `src/routes/index.tsx` (lines ~1039-1066) redraws the camera frame into the overlay canvas with `object-cover` cropping (`s = max(targetW/vw, targetH/vh)`, offset by `(targetW-dw)/2, (targetH-dh)/2`), then calls `drawHandOverlay` / `drawFaceOverlay` which multiply normalized landmark coords by the **full canvas W×H** (`src/lib/zap/overlay.ts`). The camera is 1280×720 (landscape), the PiP container is `aspect-[3/4]` (portrait), so `object-cover` crops off ~62% of the horizontal frame — landmarks end up horizontally squashed and shifted off the face.

2. **Redundant video paint.** The `<video>` element already renders the feed under the canvas via CSS `object-cover -scale-x-100`. Redrawing the same frame into the canvas underneath the landmarks wastes fill-rate and, worse, hides that the landmark space is wrong (it makes the overlay+video look self-consistent but drift from the real `<video>` behind).

## Fix

Change the paint pipeline so the canvas draws landmarks only, in the same cropped/mirrored space the `<video>` element uses.

### `src/lib/zap/overlay.ts`
- Add an optional `rect` argument `{ dx, dy, dw, dh }` to `drawHandOverlay`, `drawFaceOverlay`, and the internal `strokeConnectors`. When present, map normalized coords as `dx + x*dw`, `dy + y*dh` instead of `x*W`, `y*H`. Default (no rect) keeps current behavior for any other caller.

### `src/routes/index.tsx` (inference loop, ~1039-1066)
- Stop drawing the video into the overlay canvas — remove the `ctx.drawImage(v, ...)` block.
- Compute the object-cover rect for the current video against the canvas box:

```text
s  = max(targetW / vw, targetH / vh)
dw = vw * s;  dh = vh * s
dx = (targetW - dw) / 2
dy = (targetH - dh) / 2
```

- Pass that rect into `drawHandOverlay` and `drawFaceOverlay`. The canvas already carries the same `-scale-x-100` CSS as the video, so mirroring stays consistent (no code change needed there).

### No changes needed
- `DesktopStage.tsx` / `MobileStage.tsx` PiP markup — the CSS mirror + `object-cover` on the `<video>` and canvas already agree; only the landmark math was wrong.
- Handedness label logic in `drawHandOverlay` stays as-is (mirror-aware).

## Verification
- Rebuild, open `/`, start a session, wave a hand and tilt the face — the skeleton and face mesh should track the actual features in the PiP.
- Confirm both desktop (aspect 3/4 PiP) and mobile (portrait full-bleed camera) look correct, since both use the same overlay canvas via `overlayRef`.

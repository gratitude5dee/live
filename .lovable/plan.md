## Current state

- `MobileStage.tsx` already renders a ⇋ button that calls `flipCamera`.
- `flipCamera` in `src/routes/index.tsx` toggles `facingMode` between `"user"` and `"environment"`, but does it by calling `stopSession("manual")` + `startSession()` after 200ms. That tears down the Lucy session, resets the 90s timer, drops any applied prompt, and shows the "Connecting to Lucy" spinner — not a clean camera switch.
- The button icon (⇋) and its purpose aren't obvious on mobile.

## Goal

On mobile, tapping the camera-flip button should switch between the front (`user`) and back (`environment`) camera **without disconnecting Lucy** — the live stream keeps running, the 90s timer keeps ticking, applied prompts stay applied, and the new camera feed hot-swaps into both the local PiP and the outbound WebRTC track.

## Plan

### 1. Hot-swap the camera stream (`src/routes/index.tsx`)

Rewrite `flipCamera` to:

1. Toggle `facingMode` state.
2. Call `getUserMedia` with the new `facingMode` using the same constraint block already used by `startSession` (keep 1080×1920 desktop / mobile-optimized constraints — reuse the existing helper or extract it into a local `buildCameraConstraints(facingMode, isMobile)` so both paths stay in sync).
3. Stop the old input tracks (`inputStreamRef.current?.getTracks().forEach(t => t.stop())`) **after** the new stream is ready.
4. Update `inputStreamRef.current` and reattach it to the `<video>` element via the existing `attachInputVideo` callback path (assign `srcObject`).
5. If the compositor is running (`compositeStreamRef`), swap the new stream in via its existing input setter (or reinit the compositor with the new source).
6. If depth is on, restart `depthEngineRef` against the new stream (await its first-frame promise before swap).
7. Call `syncOutboundSource()` so the outbound WebRTC sender uses the new video track without renegotiating (`RTCRtpSender.replaceTrack(newTrack)` — already the mechanism `syncOutboundSource` uses).
8. Re-run MediaPipe engines against the new video element if they hold a stream reference.

No `stopSession` / `startSession` involved. The Lucy WebSocket, peer connection, applied prompt, ref image, recording MediaRecorder, and countdown all remain intact.

### 2. Handle failures gracefully

- If `getUserMedia` for the new `facingMode` throws (e.g. device has no back camera), keep the old stream, revert `facingMode`, and surface a small toast/error: "No back camera available".
- Disable the flip button briefly (`flipping` state) while the swap is in flight so double-taps don't stack.

### 3. Polish the mobile button

In `src/components/zap/stage/MobileStage.tsx`:

- Replace the ⇋ glyph with a clearer camera-flip icon (e.g. lucide `SwitchCamera` — already available via existing lucide imports pattern) and keep `aria-label="Flip camera"`.
- Add a tiny label pill under/next to it showing the current facing (`FRONT` / `BACK`) so users know the state at a glance. Keep it in the top-right chip cluster to match existing spacing.
- Show a subtle spinner on the button while `flipping` is true.

### 4. Desktop parity (optional but tiny)

`DesktopStage.tsx` also exposes `flipCamera` — it'll benefit from the same hot-swap automatically since the logic lives in `index.tsx`. No UI change needed there unless you want it; leaving desktop alone keeps this PR focused.

## Files touched

- `src/routes/index.tsx` — rewrite `flipCamera` to hot-swap tracks; add `flipping` state; extract shared camera-constraints helper if needed.
- `src/components/zap/stage/MobileStage.tsx` — icon + FRONT/BACK label + disabled state during flip.
- `src/components/zap/stage/types.ts` — add `flipping: boolean` to `StageViewProps` (optional, only if surfacing spinner).

No schema, transport protocol, or fal-token changes.
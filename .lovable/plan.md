## Diagnosis (unconfirmed for the exact video wiring, confirmed for transport shape)

Lucy 2.5 (`decart/lucy-2-5/realtime`) is a **WebRTC video-to-video** model. Per fal docs the SDK's `fal.realtime.connect()` establishes a WebSocket that carries WebRTC signaling; `send({ prompt })` only ships prompt updates. There is **no `image_url` frame-push path** for this endpoint — the current `fal-transport.ts` frame loop and hand-rolled `type: "offer"/"answer"/"candidate"` message shape do not match the protocol, which is why both video panels stay black even though the token mints and a "connected" pill shows.

The reference snippet you pasted also shows two smaller mismatches we need to fix:

- `tokenProvider` must return a **string**, not `{ token }`.
- `tokenExpirationSeconds` should be passed to `connect()`.

## What to build

### 1. Simplify the token flow
- `src/lib/fal-token.functions.ts`: keep the server fn, but change return to plain string (`return token;`) so `tokenProvider` can return it directly. Keep the rate-limit + `app` allowlist checks.
- `src/lib/zap/fal-transport.ts`: `tokenProvider: async (app) => await mintFalRealtimeToken({ data: { app } })`, plus `tokenExpirationSeconds: 60`.

### 2. Replace the transport with SDK-driven WebRTC
Rewrite `src/lib/zap/fal-transport.ts` to match how Lucy's realtime actually works:

- Open `fal.realtime.connect(LUCY_APP, { onResult, onError, tokenProvider, tokenExpirationSeconds })`.
- Create one `RTCPeerConnection`, `addTrack` from the input `MediaStream`, and set `pc.ontrack` to publish the returned `MediaStream` via `cb.onOutputStream`.
- Drive signaling through the SDK connection: when the SDK emits `iceServers` / `answer` / `candidate` payloads on `onResult`, apply them to the PC; when the PC emits local ICE candidates or an offer, forward via `connection.send({...})`. (This mirrors the WMA browser example and is the shape fal's realtime bridge speaks.)
- Remove the frame-push (`canvas.toDataURL` + `image_url`) path entirely. Also remove the `outputCanvas.captureStream()` fallback — recording will tap the real remote `MediaStream`.
- Keep `setOutboundPaused` (toggling sender `track.enabled`), keep `send({ prompt, enable_prompt_expansion, reference_image_url? })` for prompt updates only, and expose a single `mode: "webrtc"` (drop dual-mode UI).

### 3. Update the stage to reflect single-mode transport
`src/routes/index.tsx`:
- Drop the "frame" chip and the fallback timer messaging; header just shows `live · webrtc` or `connecting`.
- `MediaRecorder` records the remote stream from `onOutputStream` (already wired) — no change needed once the transport actually produces a real remote stream.
- Keep camera preview attached via existing callback ref.

### 4. Verify
- After edits, load `/`, click Zap Live, watch console: expect no `onError`, PiP webcam visible immediately, main stage receiving remote track within ~2–3s and Lucy repaint visible after typing a prompt + Apply.
- If Lucy still doesn't produce a remote track, capture the exact `onResult` payloads (log them) so we can confirm the signaling field names the bridge actually uses for this endpoint — that log is the only reliable oracle since the endpoint schema is empty in docs.

## Out of scope
- MediaPipe WASM `memory access out of bounds` warnings (separate issue with 0-dim video frames on first ticks; can be addressed in a follow-up by pausing inference until `videoWidth > 0` for 2 consecutive frames).
- Landing hero, gestures, presets, remote control — untouched.

## Files changed
- `src/lib/fal-token.functions.ts` (return type: string)
- `src/lib/zap/fal-transport.ts` (rewrite: SDK-driven WebRTC, drop frame push)
- `src/routes/index.tsx` (drop frame-mode UI bits; small)

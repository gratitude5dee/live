## Diagnosis (confirmed by reading the code)

You're right — right now Lucy **never** sees the raw webcam. The outbound pipeline is always:

`webcam → CompositeStream canvas (1080×1920 @ 30fps) → canvas.captureStream() → WebRTC`

That's in `src/routes/index.tsx:614-648`. Even when `activePresetKindRef === "other"` (Looks, Templates, no preset), the compositor still runs — the callback just doesn't draw an overlay. The canvas itself is still the source, so:

- Every frame is re-encoded through `canvas.captureStream()`, which browsers drive at a much lower bitrate / softer keyframe cadence than a native camera track.
- The 720×1280 webcam gets upscaled to 1080×1920, softening detail before Lucy ever receives it.
- Extra latency + a frame of blur even when nothing needs to be baked in.

So the "clean by default" contract is honoured for *content* (no landmarks baked in) but not for *pixels* (still going through a canvas). That's the quality drop you're seeing.

Two secondary contributors:
1. `getUserMedia` asks for only `width: 720 / height: 1280 ideal` (index.tsx:525) — modest even for the compositor path.
2. `VideoTransport` has no track-swap API, so today we can't switch between raw and composite mid-session; we'd have to pick one at connect time.

## Plan

Send the **raw camera track** to Lucy whenever no overlay bake is needed, and only switch to the compositor track when a Character Swap or Gesture FX preset is active. Hot-swap via `RTCRtpSender.replaceTrack()` so there's no renegotiation.

### 1. `src/lib/zap/fal-transport.ts` — add track swap

- Keep a reference to the video `RTCRtpSender` after `pc.addTrack(...)`.
- Add `replaceVideoTrack(track: MediaStreamTrack)` that calls `sender.replaceTrack(track)` (no SDP renegotiation needed for same-kind swap).
- Keep the existing `setOutboundPaused` behaviour intact.

### 2. `src/routes/index.tsx` — route by preset kind

- Bump camera constraints to `width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30 }` so the raw track is already Lucy-shaped and high-res. Fall back gracefully if the device caps lower.
- Build the compositor once (as today) but **connect with the raw camera track**:
  ```ts
  const t = new VideoTransport(stream, { ... });
  ```
- Add a small helper `syncOutboundSource()` that picks the track based on `activePresetKindRef.current`:
  - `"character_swap"` or `"gesture_fx"` → `compositor.stream.getVideoTracks()[0]`
  - `"other"` → `stream.getVideoTracks()[0]` (raw camera)
  - Calls `transportRef.current?.replaceVideoTrack(track)` only if it actually changed (track id compare) to avoid churn.
- Call `syncOutboundSource()` at the end of every place that already sets `activePresetKindRef.current`:
  - `applyPreset` (both the "other" reset and the character_swap / gesture_fx branches)
  - `applyPrompt` (manual prompt → "other")
  - `applyTemplate` (Object add-in / Try-on / Object replace → "other")
  - `stopSession` teardown path
- Keep the compositor running in the background — cheap, and it lets swaps be instant. The PiP overlay behaviour is unchanged.

### 3. Sanity: compositor stays as-is

No changes to `CompositeStream` internals or `overlay.ts`. The compositor is still the correct sink for character-swap and gesture-fx bakes; we're just not routing clean frames through it anymore.

## Expected result

- Looks (Beach, Neon, Anime, Watercolor, Sketch, Crown, Cyberpunk, Studio, NFL Night, Soccer Daylight), Templates (Object add-in, Try-on, Object replace), and free-text prompts → Lucy receives the **native 1080×1920 camera track**. Sharper input, higher effective bitrate, lower latency.
- YE / DRAKE / N3ON / MBAPPE → composite track with face mesh baked in (unchanged behaviour).
- Fire Hands → composite track with hand landmarks baked in (unchanged behaviour).
- Switching between preset kinds mid-session hot-swaps the track with no reconnect.

## Files touched

- `src/lib/zap/fal-transport.ts` — add `videoSender` field + `replaceVideoTrack()`.
- `src/routes/index.tsx` — bump camera constraints; add `syncOutboundSource()`; call it from the four kind-mutation sites; initial `VideoTransport` gets the raw track.

No schema, no UI, no new dependencies.
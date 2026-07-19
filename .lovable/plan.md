# Fix: Lucy stuck on "Connecting…" + no face overlay in PiP

## Root causes (verified against fal docs + current code)

**1. WebRTC never establishes** — `src/lib/zap/fal-transport.ts` handles inbound signaling (iceServers / sdp answer / remote candidates) but never forwards the browser's **local ICE candidates** to fal. Lucy is a signaling relay ("media flows peer-to-peer") so without trickled local candidates the peer connection never gathers a working path and stays in `checking` forever — matching the "Connecting to Lucy…" screen the user sees.

Confirmed from fal docs (`decart/lucy-2-5/realtime`): output schema is `{ iceServers, type, sdp, candidate, error }` and the model description is "Signaling relay only; media flows peer-to-peer between the browser and Decart." So the current design (WS signaling → WebRTC PC) is right, it's just missing the outbound-candidate half.

**2. Face overlay never draws face landmarks** — `src/lib/zap/overlay.ts` `drawHandOverlay` only paints hand skeletons. Face inference runs (`FaceEngine.ingest`) but the result is discarded and nothing is rendered in the PiP. There is no face-drawing path at all.

## Changes

### `src/lib/zap/fal-transport.ts`
- Add `pc.onicecandidate = (ev) => { if (ev.candidate) connection.send({ candidate: ev.candidate.toJSON() }) }` so local candidates trickle to Lucy.
- Send a final `{ candidate: null }` on end-of-candidates (some relays require it).
- Move `pc` construction to happen *after* iceServers arrive (already the case) — but also handle the case where fal sends `sdp` before `iceServers` by lazily creating pc with STUN fallback.
- Also handle `pc.oniceconnectionstatechange` and surface `disconnected` / `failed` to `onError` with a clearer message.
- Bump connect timeout from 15s to 20s for slow TURN negotiation.

### `src/lib/zap/overlay.ts`
- Add `drawFaceOverlay(ctx, faceResult)` that draws face landmark tesselation (light) + key contour lines (eyes, lips, oval) using `FaceLandmarker.FACE_LANDMARKS_TESSELATION` / `_LIPS` / `_LEFT_EYE` / `_RIGHT_EYE` / `_FACE_OVAL` connectors from `@mediapipe/tasks-vision`.
- Keep the existing hand overlay untouched.

### `src/lib/zap/face-engine.ts`
- Store `lastResult: FaceLandmarkerResult | null` on the engine so the render loop can read it (mirrors how gesture already exposes results via `lastGestureResultRef`).

### `src/routes/index.tsx`
- In the inference loop, capture the face result into a `lastFaceResultRef` on the frames it runs.
- After `drawHandOverlay(...)`, call `drawFaceOverlay(ctx, lastFaceResultRef.current)` so both are visible in the PiP.

## Out of scope
- No changes to auth, session, presets, upload, or landing UI.
- No change to token minting (already fixed).
- No new dependencies (`@mediapipe/tasks-vision` already exports the connector constants).

## Verification
After changes: refresh preview → click Zap Live → PiP should show face mesh landmarks within ~1s of camera start, and the main stage should transition from "Connecting to Lucy…" to a live Lucy-edited stream within ~5–10s. Check console for any signaling errors surfaced by the new `iceconnectionstatechange` handler.

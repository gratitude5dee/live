## Diagnosis

**Do I know what the issue is? Yes.** The camera is producing frames—MediaPipe detects the hand—so camera permission and `getUserMedia()` are working. The failure is in transport and rendering:

- The installed `@fal-ai/client` realtime client is WebSocket-only; its source contains no `RTCPeerConnection` or `MediaStream` handling.
- `fal-transport.ts` currently invents `offer`, `answer`, and ICE-candidate messages over that WebSocket. Lucy never returns the expected SDP answer, so no remote track is created and the main stage remains black.
- The header marks transport as WebRTC before a peer connection is established, masking the failure.
- Gesture and face inference run back-to-back against separate MediaPipe WASM tasks; current logs confirm repeated `memory access out of bounds` crashes.

## Fix plan

1. **Replace the guessed signaling implementation**
   - Use fal’s documented WMA WebRTC flow: create the peer connection, attach the webcam, wait for complete ICE gathering, send the SDP offer to `https://wma.fal.run/session`, and apply the returned SDP answer.
   - Proxy session creation and heartbeat through authenticated TanStack server functions so `FAL_KEY` never reaches the browser.
   - Do not use trickle ICE because the documented WMA bridge does not support it.

2. **Make connection state truthful**
   - Report `connecting` while negotiating.
   - Switch to `live · webrtc` only after a remote video track arrives and the peer connection reaches `connected`.
   - Surface signaling, ICE, timeout, and remote-track failures in the existing error strip instead of leaving a black stage.
   - Keep the local camera PiP visible independently of Lucy, so transport failure cannot hide a working webcam.

3. **Wire realtime controls to the WebRTC session**
   - Capture the session’s control data channel and send Lucy prompt/reference updates through it using the endpoint’s prompt payload.
   - Queue the latest prompt until the channel opens, then flush it.
   - Add heartbeat and deterministic cleanup for the WMA session, peer connection, data channel, and camera tracks.

4. **Stabilize MediaPipe**
   - Alternate gesture and face inference rather than invoking both WASM tasks in the same animation frame.
   - Enforce one inference at a time, strictly increasing integer timestamps, and stop the loop after a fatal WASM error instead of flooding the console.
   - Preserve the existing gesture/face behavior and adaptive performance mode.

5. **Verify the actual signals**
   - Confirm the local PiP renders non-black camera pixels.
   - Confirm the WMA session request returns an SDP answer, peer state reaches `connected`, and a remote track attaches before showing `live`.
   - Confirm prompt changes are sent only after the control channel opens.
   - Confirm the console no longer emits MediaPipe memory errors and that cleanup ends the session cleanly.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>
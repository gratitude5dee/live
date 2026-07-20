# Fix: "Computah" wake word never fires

## Diagnosis (confirmed)

I added a local VAD gate in the last turn (`src/lib/zap/voice-agent.ts` lines 81-446). It sets `audioTrack.enabled = false` at startup and only flips it on after the RMS worklet sees ~30 ms above `THRESH = 0.025` (~-32 dBFS). Two problems, either of which is enough to eat every wake word:

1. **Head-of-utterance loss.** By the time RMS crosses threshold, the speaker is already ~100-200 ms into "Comp-". Those samples were sent as silence to OpenAI, so the model hears "…utah, make the crown gold" — the wake pattern is gone and the classifier never routes. This is the failure the user is describing.
2. **Threshold too high with browser noise suppression.** Chrome/Safari `getUserMedia` defaults apply AGC + noise suppression, which pulls conversational speech down to ~0.01-0.02 RMS. A 0.025 gate frequently never opens at all in quiet rooms — the mic stays muted the entire session.

The rest of the voice stack (WebRTC transport, tool routing, `control_session`, follow-up merge, HUD hints) is fine and doesn't need to change.

## Fix

Remove the VAD gate. It was a cost/privacy optimization that broke the primary product loop; correct thing is to revert it and revisit later with a real keyword-spotter (Porcupine/openWakeWord) that runs *without* muting the outbound track.

### `src/lib/zap/voice-agent.ts`

- Delete `startVad`, `stopVad`, and the VAD-related fields (`vadNode`, `vadSource`, `vadWorkletUrl`, `audioCtx`, `micTrack`, `speaking`, `silenceTimer`, `VAD_HANGOVER_MS`).
- In the mic setup path, keep `audioTrack.enabled = true` (default) and stop calling `startVad(mic)`.
- Clean up any leftover references in `close()` so we don't try to revoke a URL or disconnect nodes that no longer exist.

### No other files change
- `voice-intent.ts`, `routes/index.tsx`, HUD hint chip, and the `control_session` tool all stay as-is. Follow-up merge and ack behavior are unaffected.

## Verification
- Rebuild, arm Computah, say "Computah, make the background a beach." — HUD should flash the ack and Lucy should receive the prompt within a couple seconds.
- Try 3-4 wake attempts in a row (including "computer" and mispronunciations) to confirm the phonetic fallback in `voice-intent.ts` still catches them.
- Watch the network tab: OpenAI Realtime should show a `response.created` shortly after each utterance, no dead silence sessions.

## Follow-up (not in this change)
When we want the mute-savings back, do it right: run a KWS model (Porcupine "computer" preset or a compiled openWakeWord "computah" model) in a worklet, keep the outbound mic **enabled** at all times, and only *drop* audio frames server-side is not an option — instead use the KWS trigger to send a `session.update` that arms/disarms `turn_detection`. That preserves head-of-utterance and still avoids paid VAD turns during silence.

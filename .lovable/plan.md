## Diagnosis

Computah currently speaks a full acknowledgment sentence and often skips or delays the tool call. Two fixes:

1. **Silence the voice output.** Switch the Realtime session from audio-out to text-out — no TTS at all. Users hear nothing; they get instant visual feedback (existing HUD chip already shows the one-word ack + intent label).
2. **Force the tool call.** Tighten the system prompt so the model's ONLY job is to emit `apply_video_edit` on any wake-word command, no chit-chat, no confirmation.

The Lucy metaprompting already works end-to-end: the tool's `lucy_prompt` argument is filled from the 7 edit templates and forwarded to `applyPrompt(..., "voice", ref)` on the client, which sends it straight into the Lucy transport. The user's complaint is upstream: the model was talking too much and sometimes never firing the tool.

## Changes

### `src/lib/zap/voice-agent.ts`
- `output_modalities: ["audio"]` → `["text"]`. Drops all TTS. Skip the audio-transcript handlers (they won't fire).
- Remove audio playback wiring is no-op — the browser just gets no incoming audio track.

### `src/lib/zap/voice-intent.ts`
- Rewrite `COMPUTAH_INSTRUCTIONS` to a lean, imperative spec:
  - Never speak. Never write prose. Your ONLY output is a tool call.
  - On wake-word command → `apply_video_edit` immediately.
  - On silence / no wake word / unclear → `wait_for_user`.
  - Keep the 7 edit-type templates and classification hints unchanged (that's the metaprompt).
  - Drop the ack lexicon and "single word" rules — irrelevant with text-only + auto-hidden output.
- Also fix the stale `OPENAI_REALTIME_MODEL = "gpt-realtime-2-mini"` fallback constant to `"gpt-realtime"` (server already returns the correct model but this keeps the client fallback honest).

### HUD (no code change, just noting behavior)
- The HUD already shows `voiceState`, transcript, and `voiceIntentLabel` chip. With no TTS, the intent chip flashing when a tool call fires becomes the sole feedback — which is what the user asked for.

## Out of scope
- Tool schema, Lucy transport, `applyPrompt`, HUD component.
- Wake-word regex / heuristics.

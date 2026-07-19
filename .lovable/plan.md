# Computah — Voice Control for Lucy Stage

Add a hands-free voice layer to the live stage. User taps a mic toggle, says "Computah <edit>", GPT Realtime classifies into one of 7 Lucy edit types, generates a Lucy-optimized prompt, speaks a one-word ack, and dispatches through the existing `applyPrompt` pipeline. Additive only — no changes to `fal-transport`, gestures, presets, or remote channel.

## Secrets
- Add `OPENAI_API_KEY` (server-only). Optional `OPENAI_REALTIME_MODEL` env override (default `gpt-realtime-2-mini`, fallback `gpt-realtime-2.1`).

## Database migration
`supabase/migrations/<ts>_computah_voice.sql`:
- Drop + recreate `prompt_events.source` check to include `'voice'`.
- Create `public.voice_events` (session_id → sessions, user_id, transcript, wake_detected, edit_type enum-checked to the 7 ids, lucy_prompt, ack_word, latency_ms, at_ms, created_at).
- Grants: `select, insert` to `authenticated`; `all` to `service_role`.
- Enable + force RLS; policy `voice_events_own` FOR ALL using/with-check `auth.uid() = user_id`.
- Index `(session_id, at_ms)`.
- Regenerate `src/integrations/supabase/types.ts`.

## New files

### `src/lib/openai-token.functions.ts`
Clone of `mintFalRealtimeToken`:
- `createServerFn` + `requireSupabaseAuth`.
- Same 30/min rate-limit via `token_mints` insert.
- POST `https://api.openai.com/v1/realtime/client_secrets` with `Authorization: Bearer ${process.env.OPENAI_API_KEY}` and body `{ session: { type: "realtime", model: OPENAI_REALTIME_MODEL, audio: { output: { voice: "cedar" } } } }`.
- Return `{ ephemeralKey, model, voice, expiresAt }`. Never leak the raw API key.

### `src/lib/zap/voice-intent.ts`
Pure constants — no side effects, safe to import client + server:
- `EDIT_TYPES` (7-id array + `{ id, label }` for HUD badge, e.g. `CHARACTER TRANSFORMATION`).
- `COMPUTAH_INSTRUCTIONS` (verbatim spec §5).
- `COMPUTAH_TOOLS` (verbatim spec §6 — `apply_video_edit`, `wait_for_user`).
- `ACK_LEXICON`, `OPENAI_REALTIME_MODEL`, `COMPUTAH_VOICE = "cedar"`.
- Regex `WAKE_WORD_RE = /comput(ah|er|a)/i`.

### `src/lib/zap/voice-agent.ts`
`VoiceAgent` class mirroring `VideoTransport` ergonomics. Constructor takes callbacks: `onState`, `onTranscript`, `onToolCall`, `onAck`, `onError`, `onIdleDisarm`.

Methods:
- `start()`:
  1. Call `mintOpenAIRealtimeSecret` server fn.
  2. `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })`.
  3. `new RTCPeerConnection()`; add mic track; `pc.ontrack` → attach remote audio to a hidden `<audio autoplay>` appended to `document.body`.
  4. `pc.createDataChannel("oai-events")`.
  5. Create offer, POST SDP to `https://api.openai.com/v1/realtime/calls?model=<model>` with `Authorization: Bearer <ephemeral>` and `Content-Type: application/sdp`, set remote answer.
  6. On DC `open`: send `session.update` with `instructions`, `tools`, `tool_choice: "auto"`, `output_modalities: ["audio"]`, `audio.input.turn_detection: { type: "semantic_vad" }`, `audio.input.transcription: { model: "gpt-4o-mini-transcribe" }`.
- Event routing on DC `message`:
  - `conversation.item.input_audio_transcription.completed` → `onTranscript`.
  - `response.output_audio_transcript.done` → `onAck(word)`.
  - `response.done` → scan `response.output[]` for `type === "function_call"` items → `onToolCall(name, argsJSON, call_id)`.
  - `error` → `onError`.
- `sendToolOutput(call_id, jsonPayload, { respond })`: send `conversation.item.create` with `function_call_output`; if `respond` also send `response.create`.
- Idle timer: 3 min without an `apply_video_edit` call → `close()` + `onIdleDisarm`.
- `close()`: stop mic tracks, close pc, remove `<audio>` element, clear timers.
- Session cap watchdog: at 55 min uptime, re-mint + reconnect transparently.

## Modified files

### `src/lib/zap/types.ts`
- Extend `PromptEventSource` to include `"voice"`.
- Export `VoiceState = "off" | "connecting" | "armed" | "thinking" | "error"`.

### `src/routes/index.tsx`
- Widen internal `applyPrompt` / `logPromptEvent` source unions to `"voice"`.
- Add refs/state: `voiceAgentRef`, `voiceState`, `voiceTranscript`, `lastVoiceIntent`, `voiceSupported` (feature-detect `RTCPeerConnection` + `getUserMedia`).
- `toggleVoice()`: guarded on `connState === "live"`. Off→connecting→armed via `VoiceAgent.start()`.
- `onToolCall` handler:
  - `wait_for_user`: reply `{status:"ok"}`, no `response.create`.
  - `apply_video_edit`: validate `edit_type` against `EDIT_TYPES`; set `voiceState:"thinking"` briefly; call `applyPrompt(lucy_prompt, "voice", use_reference_image ? refImage : null)`; reply `{status:"applied", edit_type}` **without** `response.create` (prevents second utterance); set `lastVoiceIntent`; insert `voice_events` row (transcript, wake_detected, edit_type, lucy_prompt, ack_word from `onAck`, latency_ms, at_ms). On dispatch failure reply `{status:"error"}` **with** `response.create` so Computah says "Cooked".
- Transcript fade timer (~4s).
- Auto-teardown in `stopSession()` and unmount cleanup.
- Pass new props into both stage views.

### `src/components/zap/stage/types.ts`
Add to `StageViewProps`:
- `voiceState: VoiceState`
- `voiceTranscript: string | null`
- `lastVoiceIntent: { editType: string; label: string } | null`
- `toggleVoice: () => void`
- `voiceSupported: boolean`

### `src/components/zap/stage/DesktopStage.tsx` + `MobileStage.tsx`
- Mic toggle chip in the HUD next to existing status chips. States: off (idle), connecting (pulse), armed (subtle glow ring), thinking (spinner), error (red). Disabled unless `connState === "live"` and `voiceSupported`.
- Transcript chip: last user utterance, auto-fades.
- Mode badge: shown next to the applied-prompt caption, e.g. `MODE: ADD OBJECT`, using existing glass surface style.
- No layout restructuring — reuse `SpecularButton` and existing chip patterns.

## Guardrails (enforced in code, not just prompt)
- Silence outside wake word: agent-side via `wait_for_user`; client never speaks unsolicited.
- One-word rule: enforced by instructions; on server transcript >1 word for an ack, still play it (agent is authoritative) but log for tuning.
- Voice cannot trigger snapshot/record/undo/clear/preset/stop in v1.
- Camera stream untouched; disabling voice never affects Lucy WebRTC.
- If mic permission denied → `voiceState:"error"`, toast, no auto-retry.
- Idle 3 min → auto-disarm with toast "Computah standing by".
- Ephemeral tokens only; rate-limited server-side.

## Acceptance
Matches spec §9: 7-edit test matrix, no-wake silence, unintelligible → "Huh?", failure → "Cooked", generated prompts logged to both `voice_events` and `prompt_events(source='voice')`, no `OPENAI_API_KEY` in browser bundles, clean mic teardown, mobile Safari support.

## Out of scope
Voice verbs (undo/clear/snapshot), multilingual, local wake-word spotting, voice preset selection, diarization, changes to `fal-transport.ts` / gestures / remote QR.

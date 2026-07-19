## Part 1 — Fix wake-word recognition

**Current state.** `WAKE_WORD_RE = /comput(ah|er|a)/i` and the system prompt in `COMPUTAH_INSTRUCTIONS` lists only `Computah / computer / computa / komputa`. Whisper's transcriber (`gpt-4o-mini-transcribe`) frequently emits close-but-not-listed variants (`compooter`, `kompyoota`, `computah!`, `kumpyootah`, `come pooter`, `come put a`, `commuter`), and because we set `tool_choice: "required"` the model will still route those — but only if the *instructions* let it. Right now the instructions tell it to treat non-listed variants as "not addressed to you" and call `wait_for_user`, so real commands get silently dropped.

There is also no client-side safety net: if the model mis-routes to `wait_for_user`, nothing recovers the command.

**Changes — all in `src/lib/zap/voice-intent.ts` (data-only, no logic churn):**

1. Broaden `WAKE_WORD_RE` to a phonetic set that covers what Whisper actually emits:

   ```ts
   export const WAKE_WORD_RE =
     /\b(k|c)[o0]m(p|b)[uy]?(t|d)(ah|er|a|uh|ur|or|a[hr]?)\b|\bcommut(er|ah|a)\b|\bcome\s*p(oo|u)t(er|ah|a)\b/i;
   ```

   Covers: computah, computer, computa, kompyoota, kompyootah, compoota, compooder, kumputer, commuter, "come pooter", "come put a", etc.

2. Rewrite the "Wake word" section of `COMPUTAH_INSTRUCTIONS` so the model is permissive by design:

   > The wake word is **any word that sounds like "computah"** — accept computah, computer, computa, computuh, kompyoota, kompyootah, compoota, compooter, commuter, kumputer, "come pooter", "come put a", and any similar phonetic spelling the transcriber produces. Treat all of these as the wake word. If a leading token is a near-homophone of "computah" and the rest of the utterance is an actionable video edit, call `apply_video_edit`. Only fall through to `wait_for_user` when the leading token is clearly unrelated (e.g. "hey", "what", music, silence).

3. Export a helper `matchesWake(transcript: string): boolean` using the new regex, for the client-side safety net below.

**Client-side safety net — `src/lib/zap/voice-agent.ts`:**

In `handleEvent`, when a `conversation.item.input_audio_transcription.completed` event arrives, buffer the last transcript on the instance. When the *next* `response.done` fires with no `function_call` items dispatched for that response, check `matchesWake(lastTranscript)`. If true, surface `onToolCall({ callId: synthetic, name: "wake_word_missed", args: { transcript } })` so `routes/index.tsx` can either (a) forward the raw command back into `applyPrompt(transcript, "voice")` via a lightweight local classifier, or (b) at minimum toast "Heard you — say it again" so the user knows the wake word landed but the edit didn't. Keep this minimal — the primary fix is the prompt/regex work; this is a belt-and-braces log/toast.

Verification: preview → mic on → say each of "Computer, put me on Mars", "Kompyootah, add a fedora", "Commuter, remove the background". All three must route into Lucy.

---

## Part 2 — Latency audit + optimizations

I traced the full mic-to-Lucy-repaint path. Numbers below are typical, measured/estimated:

```text
[mic] → OpenAI Realtime (STT + classify + tool call)      ~700–1400 ms   ← dominant
      → WebRTC data channel → handleEvent → applyPrompt      <5 ms
      → fal-transport.send() over WS → Lucy inference      ~600–1000 ms   ← dominant
      → new frames on <video>                              ~30–80 ms
──────────────────────────────────────────────────────────
Total wake-word → visible repaint                          ~1.3 – 2.5 s
```

Everything else in the app (MediaPipe, compositor, depth, recorder, Supabase logging) is off the critical path for a voice edit. The two dominant costs are the OpenAI turn and the Lucy turn.

### High-impact wins (do first)

1. **Fire Lucy before the tool call finishes streaming.**
   Right now we only dispatch on `response.function_call_arguments.done` / `output_item.done`. OpenAI streams `response.function_call_arguments.delta` events with partial JSON — once `lucy_prompt` is a complete quoted string (JSON-parseable prefix), we can call `applyPrompt` ~200–400 ms earlier. Requires a tiny streaming JSON reader in `voice-agent.ts` that watches for the closing quote after `"lucy_prompt":"..."`. Guard against double-fire with the existing `dispatchedCallIds` set. Expected saving: **200–400 ms** per command.

2. **Disable audio-out entirely at the transport layer.**
   `output_modalities: ["text"]` already silences TTS, but the session config still requests `audio` output implicitly and OpenAI still allocates the audio decoder pipeline. Drop the remote `<audio>` element and remove `pc.ontrack` — every ms we're not waiting on audio ICE is a ms sooner the DC opens. Also switch `turn_detection` from `"semantic_vad"` to `"server_vad"` with `silence_duration_ms: 300`. Semantic VAD adds ~200–500 ms of "is the user done thinking" delay; server VAD ends the turn as soon as the user stops speaking. Expected saving: **200–500 ms**.

3. **Warm the OpenAI session before the user speaks.**
   Today `VoiceAgent.start()` runs on mic-button click: token mint (~150 ms) + `getUserMedia` (~200 ms) + SDP round-trip (~300–600 ms) = ~1 s of dead air before the first command works. Warm on hover of the mic button (desktop) or on page focus after `authReady` (mobile) — mint the ephemeral secret and open the PC, but do not enable the mic track until click. Expected saving: **500–1000 ms** on first command.

4. **Ship Lucy the prompt without waiting for React state.**
   `applyPrompt` currently `setPrevApplied`/`setApplied` before `transport.send()`. Flip the order: call `transport.send()` first (it's synchronous WS send), then update state. Saves one React commit (~16 ms) on the critical path. Also drop the `await logPromptEvent(...)` from the critical path — fire-and-forget it. Expected saving: **20–100 ms**.

### Medium-impact

5. **Prompt-expansion off for voice.**
   `enhance` (Lucy's `enable_prompt_expansion`) adds ~200–400 ms server-side. The voice agent already produces a Lucy-optimized prompt from the template. In `applyPrompt`, when `source === "voice"`, send `enable_prompt_expansion: false`. Expected saving: **200–400 ms** for voice commands.

6. **Reference-image path: pre-upload, don't inline.**
   When `use_reference_image=true`, we currently pass a base64 data URI to Lucy. For a 1 MB image over WS, that's ~150–400 ms of upload. Pre-upload the current `refImage` to Supabase Storage on selection and pass the public URL to Lucy (Lucy accepts URLs). Expected saving: **150–400 ms** on ref-image commands.

7. **Kill the MediaPipe re-init warnings and drop landmarker FPS when idle.**
   Console shows repeated `Graph finished closing successfully` + `Successfully destroyed WebGL context` — MediaPipe is being torn down and re-created on some re-renders. Confirm with a `console.count` in `loadGestureRecognizer`. If it re-inits per remount, move loader promises to a module-scoped singleton. Not on the voice critical path, but frees ~20–40% GPU headroom for Lucy's WebRTC decode.

### Low-impact / hygiene

8. Coalesce `logPromptEvent` inserts into `visionBuffer`'s existing batch writer instead of a per-event Supabase INSERT round-trip.
9. `defaultPreloadStaleTime: 0` isn't the issue but confirm the `presets` query is cached — a stale-refetch on route focus can cost 50–100 ms.
10. Drop the `THREE.Clock deprecated` warning in `LiquidEther` (cosmetic — swap for `THREE.Timer`).

### Projected end-to-end after wins 1–5

```text
wake word → visible repaint    ~700 – 1300 ms    (down from ~1.3 – 2.5 s)
```

The rest is inside Lucy's inference and OpenAI's turn — hard floor without changing providers.

---

## Files touched by this plan

- `src/lib/zap/voice-intent.ts` — broaden regex, rewrite wake section, export `matchesWake`.
- `src/lib/zap/voice-agent.ts` — streaming-args early dispatch, drop remote audio track, server_vad, prewarm hook, wake-miss surfacing.
- `src/routes/index.tsx` — `applyPrompt` reorder + fire-and-forget log, `enable_prompt_expansion: false` for voice, ref-image pre-upload path, prewarm on mic-button hover.
- `src/lib/zap/mediapipe.ts` — module-scoped singleton for loaders (only if re-init is confirmed).

No schema changes. No new dependencies.

## Verification

1. Typecheck.
2. Wake-word matrix: say each of computah / computer / computa / kompyoota / commuter / "come pooter" + a command; each must route.
3. Instrument `voice-agent.ts` with `performance.now()` at (a) mic-button click, (b) DC open, (c) first `response.function_call_arguments.delta`, (d) `apply_video_edit` dispatched, (e) `transport.send()` returned. Post to console, confirm ~700–1300 ms budget in preview.
4. Ref-image command with pre-uploaded URL — confirm Lucy accepts it and repaint is visibly faster than base64 path.

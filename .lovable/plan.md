## Problem

Two symptoms, one root cause:

1. Console: `Missing required parameter: 'session.type'` — thrown by OpenAI Realtime the moment we send `session.update`.
2. Computah replies conversationally instead of firing `apply_video_edit` — because the `session.update` was rejected, the server never received our instructions, tools, or `tool_choice: "auto"`. It falls back to the default assistant persona with no tools registered, so no metaprompt is applied and no tool call reaches Lucy.

The GA `gpt-realtime` model uses the new session schema where the `session` object requires a discriminator field `type: "realtime"` (vs `"transcription"`), and `output_modalities` / `audio` / `tools` all live under that same realtime session block. Our current payload omits `type`, so the whole update is dropped.

## Fix (single file: `src/lib/zap/voice-agent.ts`)

Update `configureSession()` to send the GA-shaped payload:

```ts
this.send({
  type: "session.update",
  session: {
    type: "realtime",
    model: this.model,
    instructions: COMPUTAH_INSTRUCTIONS,
    tools: COMPUTAH_TOOLS,
    tool_choice: "auto",
    output_modalities: ["text"],
    audio: {
      input: {
        turn_detection: { type: "semantic_vad" },
        transcription: { model: "gpt-4o-mini-transcribe" },
      },
    },
  },
});
```

Key changes vs current code:
- Add `type: "realtime"` (fixes the 400).
- Add `model: this.model` (GA schema requires it inside the session block).
- Everything else stays as-is; `output_modalities: ["text"]` keeps Computah silent as previously requested.

## Verification

1. Typecheck.
2. In the preview, click Computah, say "make the background a beach". Expect:
   - No `missing_required_parameter` error in console.
   - HUD shows the intent chip (e.g. "Scene change").
   - Lucy's feed repaints — confirms the tool call reached `applyPrompt`.
3. If OpenAI now rejects any other field on the GA schema, read the error message and align that specific field only; do not carry over pre-GA shapes.

No other files change. No changes to `voice-intent.ts` (tools/instructions are already correct) or `openai-token.functions.ts` (model id `gpt-realtime` is correct).

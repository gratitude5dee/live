## Root cause

OpenAI returned `404 model_not_found` for `gpt-realtime-2-mini` — that model id does not exist. The default in `src/lib/openai-token.functions.ts` (line 33) is wrong, so the ephemeral secret mint targets a nonexistent model and the SDP exchange 404s.

## Fix

Change the default model in `src/lib/openai-token.functions.ts` from `"gpt-realtime-2-mini"` to `"gpt-realtime"` (OpenAI's current GA Realtime model, released Aug 2025 — supports WebRTC, tools, and voice).

That's the only edit needed — `voice-agent.ts` already respects whatever model the mint returns, and `OPENAI_REALTIME_MODEL` env override still works for later swaps.

## Verify

Click 🎙 Computah → mic prompt → HUD goes armed. If OpenAI still 404s, we swap to `gpt-4o-realtime-preview-2024-12-17` (older but universally available).

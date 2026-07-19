## Diagnosis

The `session.type: "realtime"` fix landed, so the session now configures without error. But two problems remain and together they explain "Lucy never repaints":

1. **We only harvest tool calls from `response.done`.** On the GA `gpt-realtime` model, function-call output almost always arrives on the streamed event `response.function_call_arguments.done` (fields: `call_id`, `name`, `arguments`). `response.done` sometimes lands without the `function_call` item populated (or with a different shape). Result: we classify perfectly on OpenAI's side, but the WebRTC data-channel handler never fires `onToolCall`, so `applyPrompt` is never called and Lucy stays on the current prompt.
2. **`tool_choice: "auto"` lets the model emit a plain text response.** With `output_modalities: ["text"]` that produces silent, invisible text turns instead of a tool call, matching the user's report ("just answering, not applying"). We already tell the model in the system prompt to only call tools, but the API-level guard is missing.

Neither symptom involves Lucy's own realtime session — Lucy is fine; nothing is being handed to it.

## Fix — two files, minimal

### 1. `src/lib/zap/voice-agent.ts` — handle the streaming tool-call event

In `handleEvent`, add a branch before the `response.done` block:

```ts
if (type === "response.function_call_arguments.done") {
  const m = msg as { call_id?: string; name?: string; arguments?: string };
  const name = String(m.name ?? "");
  const callId = String(m.call_id ?? "");
  let args: unknown = {};
  try { args = m.arguments ? JSON.parse(m.arguments) : {}; } catch { args = {}; }
  if (name === "apply_video_edit") this.resetIdle();
  if (name && callId) this.cb.onToolCall({ callId, name, args });
  return;
}
```

Also add a `response.output_item.done` branch that extracts the same fields when `item.type === "function_call"` (belt-and-braces; some SDKs emit only this one). Guard against double-firing by keeping a small `Set<string>` of already-dispatched `call_id`s on the instance and short-circuit if seen.

Keep the existing `response.done` handler as a final fallback.

### 2. `src/lib/zap/voice-agent.ts` — force tool usage at the API layer

In `configureSession()`, change:

```ts
tool_choice: "auto",
```

to:

```ts
tool_choice: "required",
```

Combined with the two tools we already registered (`apply_video_edit` for real commands, `wait_for_user` for silence/noise), the model must pick one every turn and can never fall back to freeform text.

No other files change. Instructions, tool schemas, `handleVoiceToolCall` in `routes/index.tsx`, and `openai-token.functions.ts` are already correct.

## Verification

1. Typecheck.
2. In preview: click Computah → say "Computah, put me on a sunlit beach with waves".
   - HUD chip flips to "CHANGE BACKGROUND".
   - Lucy feed repaints within ~1s.
3. Try one from each intent (character transform, add object, replace object, change attribute, remove object, change background, restyle) and confirm all 7 route through and repaint.
4. If any turn still doesn't fire, read the WebRTC event log (add a `console.debug` on `type` inside `handleEvent` temporarily) to see which envelope OpenAI actually shipped and add that branch — do not guess.

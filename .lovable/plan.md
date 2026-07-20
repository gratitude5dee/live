## Scope

Eight self-contained polish items from the audit. All frontend — no schema, no server functions, no transport rewrites beyond a reconnect loop around the existing `VideoTransport.start()`.

## 1. Onboarding coach marks (🟡)

New `src/components/zap/CoachMarks.tsx`. Three dismissible glass chips shown on first live session, keyed by `sessionStorage["zap.coach.v1"]`:

- "👍 commits · 👎 undoes"
- "🖐 hold to clear"
- "Say 'Computah…' to talk"

Fade in staggered (400ms apart), auto-dismiss after 8s or on click. Mounted from `DesktopStage` and `MobileStage` while `connState === "live"`.

## 2. Latency HUD (🟡)

Extend the existing perf chip. In `src/routes/index.tsx`:

- On every `applyPrompt`, stamp `lastPromptSentAt = performance.now()`.
- Attach `requestVideoFrameCallback` to the output `<video>` in the stages; the first frame after `lastPromptSentAt` computes `glass-to-glass = now - lastPromptSentAt`, EMA-smoothed (α=0.3).
- Expose via `StageViewProps.latencyMs` and render next to the perf chip. Fallback silently on Safari where `requestVideoFrameCallback` is missing.

## 3. Reconnect path (🟡)

`VideoTransport` gains `onStateChange("reconnecting" | "connected" | "failed")`. On `iceConnectionState === "failed"` or the 20s connect-timeout:

- Close pc + WS, reopen with exponential backoff (1s, 2s, 4s; max 3 tries).
- Signal `reconnecting` between attempts; `flushPrompt()` already re-sends `lastPrompt` on reconnect.
- After 3 failures, surface the current terminal error.

`src/routes/index.tsx` maps `reconnecting` to `ConnectionState` and shows a subtle amber pill in the header.

## 4. A/B wipe on desktop (🟡)

New `src/components/zap/stage/CompareWipe.tsx` layered over `DesktopStage`'s full-viewport output:

- Renders a second `<video>` bound to the raw input stream, clipped with `clip-path: inset(0 <x>% 0 0)`.
- Pointer-draggable vertical handle; hidden by default, toggled with a `⇔` glass button in the top-right cluster and the `\` key.
- Desktop only (skipped in `MobileStage`).

## 5. Countdown urgency (🟢)

In the 90s pill component (currently in `DesktopStage`/`MobileStage`):

- `t > 15s` → white/neutral (today's look).
- `t ≤ 15s` → amber glass + text.
- `t ≤ 5s` → amber + `animate-pulse`.
- No "+30s" button in this pass (economics/token-mint tradeoff — flag for follow-up).

## 6. Touch targets on mobile (🟢)

Move the PiP `Source` / `Depth` toggles out of the tiny PiP corner:

- On mobile, render them as two 44×44 pill buttons inside the existing bottom sheet, above the prompt dock.
- Desktop keeps the corner chips (bumped to `min-h-9`).

## 7. Haptics (🟢)

Tiny helper `src/lib/zap/haptics.ts` exposing `haptic("tick" | "ack" | "record")` → `navigator.vibrate([10])` / `[10,40,10]`. Wired at:

- `GestureEngine.onFire` (tick)
- Voice tool-call ack in `voice-agent.ts` (ack)
- `startRecording` / `stopRecording` (record)

Guarded by `"vibrate" in navigator` and a `prefers-reduced-motion` check.

## 8. Reduced motion + battery + a11y (🟢)

- `LiquidEther`, `Prism`, `Iridescence`, `Strands`: check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` → skip the rAF loop and render a static first frame; also pause loops on `document.visibilitychange` when `hidden`.
- Applied-prompt caption and Computah HUD in both stages get `role="status" aria-live="polite"`.
- `ASCIIText` wordmark gets `aria-label="Zap"` with the canvas `aria-hidden`.

## Technical notes

```text
src/
  components/zap/
    CoachMarks.tsx              [new]
    stage/
      CompareWipe.tsx           [new, desktop only]
      DesktopStage.tsx          [edit: latency chip, countdown color, wipe toggle, aria-live]
      MobileStage.tsx           [edit: latency chip, countdown color, source/depth in bottom sheet, aria-live]
  lib/zap/
    haptics.ts                  [new]
    fal-transport.ts            [edit: onStateChange + reconnect loop]
  components/reactbits/
    LiquidEther.tsx             [edit: reduced-motion + visibility pause]
    Prism.tsx                   [edit: same]
    Iridescence.tsx             [edit: same]
    Strands.tsx                 [edit: same]
    ASCIIText.tsx               [edit: aria]
  routes/index.tsx              [edit: latencyMs plumbing, reconnect state, coach marks mount]
```

No new dependencies, no migrations. All items are additive and independently revertable.

## Out of scope

- "+30s" session extension (needs token-mint policy call)
- Server-side latency instrumentation (`prompt_events` already logs client-side)
- Rebuilding the perf chip layout

## Status: ~60% of the spec is in, core loop works — several signature features are still missing

### Done (M0–M2 + partial M3–M8)
- Supabase foundation: schema, RLS, buckets, 10 seeded presets, anonymous auth.
- Token mint via TanStack server fn (stack-appropriate substitute for the Edge Function) with app allowlist + 30/min rate limit.
- Camera + stage + prompt dock (Apply/Enhance/Clear/Undo).
- fal Lucy connect with dual VideoTransport (WebRTC preferred, frame-push fallback).
- MediaPipe GestureRecognizer + gesture engine (commit/undo/next/clear/snapshot/toggle_reactive/toggle_hud with streak + Open_Palm hold).
- Recording + snapshots → Storage → `takes` rows; `/library` list + delete.
- `/remote/$sessionId` with QR, heartbeat, gesture ticker, current-prompt display.
- prompt_events logged; realtime broadcast bus wired.

### Missing / incomplete vs goal.md
1. **FaceLandmarker + Reactive Face mode (§7.3)** — not implemented. No jawOpen/browInnerUp triggers, no "no-face 3s pause outbound" behavior.
2. **vision_events batching (§4.4)** — currently inserted one-by-one; spec requires in-memory buffer flushed every 5s / 200-row cap.
3. **PiP overlays (§6.4)** — hand skeleton, face mesh, live label + hold-progress ring not drawn.
4. **Pinch preset scrub (§7.1)** — not implemented.
5. **HUD toggle (Pointing_Up + `H` key)** — action wired but no UI response.
6. **Save-as-preset button (§8)** — not built.
7. **Keyboard shortcuts (§10 M7)** — Space/R/V/1–9 partly there; `H` HUD and `V=PiP` semantics need review (`V` is currently Undo).
8. **First-run gradient hero + "Loading vision models…/Connecting to Lucy…" states (§11)** — using a minimal shell instead.
9. **Reconnect state machine (§12)** — exponential backoff 1/2/4/8/16s with max-5 not formalized; today it's ad-hoc.
10. **Session cleanup + stats update on unmount, and `sessions.transport` write** — partial (transport recorded, but stats jsonb + ended_at update on unload is not guaranteed).
11. **pg_cron hourly "close abandoned sessions" job (§4.4)** — not scheduled.
12. **Tab-hidden >60s pause outbound (§12)** — not implemented.
13. **Takes drawer in the stage header with QR (§10, §11)** — QR lives on remote route; stage-side drawer + inline QR not built.
14. **Un-uploaded-take refresh warning (§14)** — not implemented.
15. **Performance mode auto-drop to every-3rd-frame chip (§6.2)** — not implemented.

### Proposed next milestone — finish M6 + M7 polish

Order (each independently demoable):

1. **Batched vision_events writer** — module-level ring buffer + 5s/200-row flush + flush-on-unmount. Small, unblocks acceptance criterion.
2. **FaceLandmarker + Reactive Face** — add loader, blendshape thresholds, auto-revert timer, no-face pause; badge + logging as `source:'face', kind:'reactive'`.
3. **PiP overlays** — draw hand skeleton (cyan/magenta), fingertip dots, Open_Palm hold ring, current label+score under PiP. Face tesselation when Reactive is on.
4. **Save-as-preset** — button next to prompt dock; insert into `presets` with `user_id`; refetch rail.
5. **HUD toggle + shortcut audit** — bind `H`, remap `V` to PiP-toggle, keep Undo on a distinct key (spec §10 lists `V=PiP`). Fade non-stage chrome.
6. **First-run gradient hero + loading phases** — pre-camera CTA screen; explicit "Loading vision models…" and "Connecting to Lucy…" phases in the state machine.
7. **Reconnect backoff + tab-hidden pause + session end/stats write** — formalize the state machine from §12 including cleanup path.
8. **Stage takes drawer with inline QR** — surface current-session takes + remote QR from the header.
9. **Un-uploaded-take beforeunload warning + performance-mode chip + pinch preset scrub** — smaller polish items batched last.

`pg_cron` abandoned-session cleanup ships as a small standalone migration whenever you want it — it's independent of the client work.

### Question before I start

Want me to knock these out in the order above, or reprioritize? Common alternatives: (a) ship FaceLandmarker + overlays + batching first (most visible spec gap), (b) do the state-machine/reconnect + cleanup hardening first (most fragile in production), (c) do save-as-preset + drawer + QR first (most visible product polish).
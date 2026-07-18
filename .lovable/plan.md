# ZAP-LIVE Build Plan

Building the app exactly per `goal.md`. Executing milestones M0→M8 in order, each demoable.

## Stack adjustments to the spec

The spec targets Supabase Edge Functions + `anon` role and `SUPABASE_ANON_KEY`. This project is TanStack Start on Lovable — server-side logic belongs in `createServerFn` / server routes, not Supabase Edge Functions. Adjustments:

- **Token mint (`fal-realtime-token`)** → TanStack server route at `src/routes/api/fal-realtime-token.ts` using `requireSupabaseAuth` middleware. Reads `FAL_KEY` from `process.env` (stored via `add_secret`). Same rate limit (30 mints/min via `token_mints` table), same allowlist (`decart/lucy-2-5/*`), same 60s JWT.
- **Auth role**: RLS policies use `authenticated` (anonymous auth still counts). Publishable key (`sb_publishable_*`) in place of legacy anon key naming.
- Everything else (schema, RLS, Realtime channels, Storage, client MediaPipe pipeline, fal client, UI) follows the spec verbatim.

## Milestones

### M0 — Supabase foundation
- One migration: `sessions`, `prompt_events`, `vision_events`, `takes`, `presets`, `token_mints` — with GRANTs, RLS enabled + forced, `(select auth.uid())` policies, all indexes per §4.2/4.3, plus 10 built-in preset seeds.
- Storage buckets `takes` + `refs` (private) via `storage_create_bucket`; per-user-folder policies on `storage.objects`.
- Enable anonymous sign-in in Supabase Auth settings (user action; I'll link them).
- Add `FAL_KEY` secret via `add_secret`.

### M1 — Camera & shell
- Replace `src/routes/index.tsx` placeholder with the Stage layout (§11 chrome, dark theme tokens in `styles.css`).
- Anonymous sign-in on load; insert `sessions` row; connection state machine (§12) skeleton.
- getUserMedia 720p30, raw stage + mirrored PiP.

### M2 — Lucy live (magic moment)
- Server route `/api/fal-realtime-token` (rate-limited, app-allowlisted, mints fal JWT).
- `@fal-ai/client` connection with `tokenProvider` hitting the server route.
- VideoTransport B (frame push) end-to-end.
- Prompt dock: text + Enhance toggle + Apply/Clear; log to `prompt_events`; broadcast `prompt` on channel.

### M3 — Transport A (WebRTC) + auto-fallback
- Negotiate offer/answer/ICE through `connection.send` per §5.3.
- 8s no-track timeout → tear down and fall back to B; write `sessions.transport`; status chips.

### M4 — Presets & reference images
- Preset rail from `presets` table (built-ins + user rows); "save current as preset".
- Ref image upload: validate ≥512², downscale to 1024, data URI to fal + upload to `refs`; atomic `send()`; Undo via `previous` state.

### M5 — MediaPipe pipeline
- Load `@mediapipe/tasks-vision` GestureRecognizer + FaceLandmarker (GPU, VIDEO mode) from CDN.
- rAF loop, every-2nd-frame inference, perf-mode auto-drop.
- Overlay canvas: hand skeleton + face mesh with spec colors.

### M6 — Gestures, expressions, event bus
- Full §7 grammar with stability rules (6-frame ≥0.7, 1.5s cooldown, Open_Palm 800ms hold ring, pinch scrub).
- Reactive Face mode (jawOpen / browInnerUp / no-face).
- Broadcast on `sess:{id}` channel (throttled ≤10 msg/s); batched `vision_events` insert (5s / 200 rows / session-end).

### M7 — Recording & Takes library
- MediaRecorder on stage `captureStream(30)`, VP9→VP8, 1s slices, 10-min cap.
- Local download immediate + background upload to `takes` bucket with progress; insert `takes` row; retry on failure.
- Snapshots via Closed_Fist → PNG.
- Takes drawer + `/library` route (keyset pagination, signed URLs, delete).
- Keyboard shortcuts (Space/V/R/H/1–9,0).

### M8 — Phone Remote
- Route `/remote/$sessionId`; QR in Takes drawer header.
- Mobile-first control deck: current prompt, state, preset grid, prompt field, Apply/Undo/Clear, live gesture ticker.
- Broadcasts `remote` messages; host is single writer to fal.
- 5s heartbeat timeout → "Host offline".

## Technical notes

- **Realtime**: `supabase.channel('sess:{id}')` with broadcast (not `postgres_changes`); subscribe in `useEffect` with `removeChannel` cleanup.
- **Server route auth**: bearer attached automatically by existing `functionMiddleware` in `src/start.ts`.
- **Session cleanup**: on unmount/`beforeunload` close fal connection, stop tracks/recorder, close MediaPipe, remove channel, update `sessions.ended_at + stats`.
- **Public route**: `/` and `/remote/$sessionId` stay public (anon auth happens client-side); no `_authenticated/` gate needed since anonymous sign-in is automatic.
- **`pg_cron`** hourly abandoned-session sweep in the M0 migration.

## Acceptance
All §14 criteria; verified with two browsers for RLS isolation and phone for Remote latency.

## Open questions before I start
1. **Anonymous auth** must be enabled in the Supabase dashboard (Auth → Providers → Anonymous). I'll link you after M0; confirm you're OK enabling it.
2. **`FAL_KEY`** — I'll open the secure secret form when M2 begins. You'll paste your fal.ai key.
3. Any deviation from the milestone order, or should I ship M0–M2 first and pause for the "magic moment" demo before continuing?

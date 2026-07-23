## Current state (verified)

None of the Happy Oyster files exist in this project:

- `src/routes/discover.tsx` — missing
- `src/routes/api.reactor.token.ts` — missing
- `src/components/happy-oyster/` — missing (14 files expected)
- `src/lib/happy-oyster/` — missing (5 files expected, incl. `reactor-setup.functions.ts`)
- `src/styles/happy-oyster.css` — missing
- `public/worlds/` — missing (6 jpgs expected)

Your instructions assume a prior port landed on `main`; it didn't. So step 1 is to actually port the Happy Oyster example (Next.js → TanStack Start), then do the config/secret steps you listed.

The reference source is the workspace example at `examples/happy-oyster/` (Next.js App Router). It is not present in this sandbox; I'll fetch it from `github.com/reactor-team/js-sdk` (path `examples/happy-oyster`) at build time.

## Plan

### 1. Dependencies + config (exactly as you specified)

- `package.json` → add and install:
  - `@reactor-models/happy-oyster@0.2.1`
  - `@reactor-team/js-sdk@^2.12.0`
  - `@reactor-team/ui@^1.4.0`
- `bunfig.toml` → append those three names to `minimumReleaseAgeExcludes`.
- `tsconfig.json` → add `"resolveJsonModule": true` under `compilerOptions`.
- `src/styles.css` → immediately after `@import "tw-animate-css";` add the two `@import` lines you provided (Reactor UI styles + `./styles/happy-oyster.css`). Nothing else changes.
- `src/styles/happy-oyster.css` → create with the exact byte-for-byte content you supplied.

### 2. Port the Happy Oyster example

Fetch files from `reactor-team/js-sdk` `examples/happy-oyster/` and land them under:

- `public/worlds/*.jpg` (6 images, copied as-is)
- `src/components/happy-oyster/*` (14 files — `ho-client.tsx`, `Sidebar.tsx`, `Screen.tsx`, `Composer.tsx`, `Gallery.tsx`, `StatusBadge.tsx`, `AdventureControls.tsx`, `DirectingControls.tsx`, `use-world-session.ts`, `ui.tsx`, plus the `Header.tsx` and `components/ui/button.tsx` referenced)
- `src/lib/happy-oyster/*` (5 files — `worlds.ts`, `view.ts`, `world-pins.json`, `featured-worlds.json`, and a new `reactor-setup.functions.ts` server fn that gates the page on `REACTOR_API_KEY` being set)
- `src/routes/discover.tsx` — page route. Wraps the app in a `<div className="ho-scope dark">` so the scoped theme in `happy-oyster.css` applies. Calls the setup gate; if `REACTOR_API_KEY` is missing, renders a "Setup required" card, otherwise renders the ported `HappyOysterApp`.
- `src/routes/api.reactor.token.ts` — TSS server route, `GET` handler that POSTs to `https://api.reactor.inc/tokens` with the `Reactor-API-Key: process.env.REACTOR_API_KEY` header (read inside the handler, never at module scope), returns `{ jwt }` with `Cache-Control: private, max-age=<remaining ttl>`. Placed at `src/routes/api.reactor.token.ts` (matches your requested path `/api/reactor/token`); not under `api/public/` because it must stay auth-scoped to the app.

Porting adjustments (mechanical only — no redesign):

- `"use client"` directives stripped (TSS is client-first per route).
- `next/image` → `<img>`; `next/link` → `@tanstack/react-router` `Link` where used for nav; asset URLs (`/worlds/…`) stay identical because we mirror them under `public/worlds/`.
- The Next `app/api/reactor/token/route.ts` handler becomes a TSS server route with the same fetch/caching semantics.
- Client SDK calls fetch the JWT from `/api/reactor/token` — the API key never touches browser code or a `VITE_*` var.

### 3. Secret

Use `secrets--add_secret` for `REACTOR_API_KEY` so you paste it into the secure form. It becomes `process.env.REACTOR_API_KEY` in the server runtime and is read by:

- `src/lib/happy-oyster/reactor-setup.functions.ts` (page gate)
- `src/routes/api.reactor.token.ts` (JWT mint)

### 4. Verification (report only, no "fixes")

- Wait for the auto-build; report pass/fail verbatim.
- Load `/` — confirm the existing home page still renders (nothing outside `.ho-scope` should be restyled).
- Load `/discover`:
  - Before the secret is set: expect the "Setup required" card.
  - After the secret is set + preview restarted: expect the HappyOyster sidebar ("Example worlds") + big screen panel.
- `GET /api/reactor/token`: confirm response shape `{ "jwt": "..." }` and `Cache-Control: private, max-age=…` header.

Report findings verbatim, including any console/server errors. No creative fixes.

## Technical notes

- The `.ho-scope` wrapper carries both `ho-scope` and `dark` so the doubled-specificity selector in `happy-oyster.css` wins over the project's global `.dark { … }` block.
- `reactor-setup.functions.ts` is a `createServerFn` with no auth middleware — it only reports whether the env var is present (boolean), never leaks the value.
- The token route reads `process.env.REACTOR_API_KEY` inside the handler (Workers inject env per-request); it uses the Reactor `expires_at` to compute `max-age`.
- `resolveJsonModule` is needed because `world-pins.json` and `featured-worlds.json` are imported from `src/lib/happy-oyster/`.

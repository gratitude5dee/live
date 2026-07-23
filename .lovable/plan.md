## Plan: Wire up Reactor token route + /discover page

### Files to create (byte-for-byte, as provided)

1. **`src/routes/api.reactor.token.ts`** — TanStack Start server route that mints a Reactor JWT via `POST https://api.reactor.inc/tokens`, returned as a cacheable GET with `Cache-Control: private, max-age=...`.

2. **`src/routes/discover.tsx`** — `/discover` page with `ssr: false`, `React.lazy` import of `HappyOysterApp` (mandatory — a static import bundles the browser-only Reactor SDK into the Cloudflare Worker and 500s every route), loader calling `getReactorSetup()`, and `SetupRequired` fallback when no key.

### Secret

3. Add backend secret **`REACTOR_API_KEY`** via `add_secret` (user pastes value in secure form). Consumed as `process.env.REACTOR_API_KEY` by both `reactor-setup.functions.ts` and `api.reactor.token.ts`. Never exposed as `VITE_*`.

### Verification

4. Confirm build passes and route tree regenerates with `/discover` and `/api/reactor/token`.
5. Manually verify:
   - `GET /api/reactor/token` returns `{ jwt }` + correct `Cache-Control` header.
   - `/discover` renders HappyOyster shell (badge, 6 world tiles, Compose, Return-to-world); home page unchanged.
   - Sunny Meadow → 4-step Adventure journey → live stream with WASD + 1:00 countdown → "Travel ended" card.
   - Coral Abyss → Directing UI with instruction input + Pause/Resume/Rewind, sent instruction appears in Story timeline.

### Non-goals (do not touch)

- No edits to any happy-oyster component or lib file.
- No restyling to shadcn/design tokens.
- Keep `ssr: false` + `React.lazy` structure exactly as specified.
- Keep GET (not POST) for the token route.

### Report

Report build result verbatim; if any error, paste it as-is without creative fixes.

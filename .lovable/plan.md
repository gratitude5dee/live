
## Current state (verified)

- `/discover` route (`src/routes/discover.tsx`) is fully implemented: `ssr: false`, calls the `getReactorSetup` server fn in the loader, renders `<HappyOysterApp />` when a key is configured or `<SetupRequired />` otherwise.
- The full happy-oyster surface is ported under `src/components/happy-oyster/*` and `src/lib/happy-oyster/*` (HappyOysterApp, LiveClientProvider, useWorldSession, Screen, Sidebar, Adventure/Directing controls, Composer, Gallery, SetupRequired, view/journey reducer, worlds + pins + featured JSON).
- Server-side token mint route `src/routes/api.reactor.token.ts` mirrors happy-oyster's Next route: GET → POST `${REACTOR_COORDINATOR_URL || https://api.reactor.inc}/tokens` with `Reactor-API-Key`, returns `{ jwt }` with `Cache-Control: private, max-age=…` synced to `expires_at`.
- Theme scoped via `src/styles/happy-oyster.css` on `.ho-scope` (imported from `src/styles.css`); world thumbnails present in `public/worlds/*.jpg`.
- Dependencies pinned: `@reactor-models/happy-oyster@0.2.1`, `@reactor-team/js-sdk@^2.12.0`, `@reactor-team/ui@^1.4.0`.
- `bunx tsgo --noEmit` passes with no errors.
- Project secrets currently configured: `FAL_KEY`, `LOVABLE_API_KEY`, `OPENAI_API_KEY`. **`REACTOR_API_KEY` is not set** — this is the only reason `/discover` currently renders the Setup page on the deployed site.

Nothing else is blocking build or deploy. The port is complete and typesafe; the sole gap between "renders SetupRequired" and "the full happy-oyster experience live at /discover on the published URL" is the runtime secret.

## Plan

1. **Get the Reactor API key from you.** I can't create one on your behalf — Reactor issues it. Steps:
   - Visit https://www.reactor.inc/account/api-keys
   - Create a key (starts with `rk_`)
   - Paste it into the secure prompt I'll open next
2. **Save it as `REACTOR_API_KEY`** via `add_secret` so the `/api/reactor/token` server route can mint short-lived JWTs. The key stays server-side; only the JWT crosses to the browser.
3. **Publish** so the new secret is live in production (preview picks it up immediately; production needs a publish per Lovable's env deploy rules).
4. **Smoke-test** `/discover` on the preview URL: confirm `SetupRequired` is gone, gallery renders, a world can `connect → create/attach → travel → stream`, `/api/reactor/token` returns 200 with a cached `jwt`.

### Optional polish (only if you want it now)

- Seed real `encryptedWorldId`s into `src/lib/happy-oyster/world-pins.json` for the "sunny-meadow" and "coral-abyss" featured worlds so they attach instantly (~1s) instead of taking the ~30s build path. Skipped by default — the placeholder pins are treated as unpinned and the create path just works.
- Add a `REACTOR_COORDINATOR_URL` secret if you ever need to point at a non-default coordinator. Not needed for standard Reactor cloud.

## Technical notes

- `getReactorSetup` is an unauthenticated server fn returning `{ hasKey }`; safe to call from a public loader. `ssr: false` on the route means it runs client-side after hydration — no SSR/prerender path can throw.
- The Reactor SDK is WebRTC/browser-only; it never imports from any server module. `HappyOysterVideo` is only mounted under `LiveClientProvider`, which itself is only reached on the client.
- Token route reads `process.env.REACTOR_API_KEY` inside the handler (not at module scope) — correct for the Cloudflare Worker runtime.
- No code changes are needed to ship /discover; step 2 alone unlocks it. Confirm and I'll open the secret prompt.

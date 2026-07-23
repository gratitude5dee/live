
## Confirm `/discover` builds and deploys without touching the rest of the app

Already verified this turn:
- `bun run build` → exit 0. Nitro produced `dist/server/_ssr/discover-*.mjs` and bundled the Reactor SDK chunk (`@reactor-models/happy-oyster+[...].mjs`, 1.71 MB). No warnings other than a benign Rollup `inlineDynamicImports` notice.
- Headless GET `http://localhost:8080/discover` → 200. Page renders `HappyOysterApp` (SetupRequired count = 0). Zero console or page errors.
- `GET /api/reactor/token` → 200 with a `jwt` field. `REACTOR_API_KEY` is set in project secrets.
- Publish scheduled — production site will be live at https://live.5-dee.com within ~1 minute (custom domain propagation can add a couple more).
- No other routes, components, or migrations were modified in this cycle. The Reactor work is isolated to:
  - `src/routes/discover.tsx` (ssr:false)
  - `src/routes/api.reactor.token.ts`
  - `src/lib/happy-oyster/*` + `src/components/happy-oyster/*`
  - `reactor-setup.functions.ts`

Nothing to change. Awaiting your go-ahead to run a fresh post-deploy smoke check against https://live.5-dee.com/discover once propagation finishes (fetch the page, confirm 200 + no SetupRequired banner, hit `/api/reactor/token` on the live host). Approve this plan and I'll run that verification in build mode.

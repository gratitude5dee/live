
## Verification plan for `/discover`

Current state (already verified this session):
- `REACTOR_API_KEY` is now saved in project secrets — the /api/reactor/token route will mint JWTs.
- `bunx tsgo --noEmit` passes with zero errors.
- Route is `ssr: false`, loader calls unauthenticated `getReactorSetup`, no prerender path can throw.
- Reactor SDK is browser-only and only mounted under `LiveClientProvider` inside the `ssr: false` component.

Verification steps to run:

1. **Production build** — `bun run build` and confirm the Nitro/Cloudflare bundle completes with no errors. This catches Worker-runtime issues (Node-only imports, `process.env` at module scope, unresolved packages) that typecheck can't see.
2. **Dev-server log scan** — check `/tmp/sandbox-state.db` for any Vite errors/warnings referencing `discover`, `reactor`, `happy-oyster`, or the SDK packages.
3. **Preview smoke test** with headless Playwright:
   - GET `http://localhost:8080/discover` → 200, page renders `HappyOysterApp` (not `SetupRequired`).
   - Screenshot the loaded gallery for visual confirmation.
   - GET `/api/reactor/token` → 200 with a `jwt` field and `Cache-Control: private, max-age=…`.
   - Capture any console errors.
4. **Publish** to production so the `REACTOR_API_KEY` is deployed (preview already has it; production requires publish per Lovable's env-deploy rules), then report the live URL.

Report back with: build status, any warnings, screenshot path, token endpoint status, and the published URL. Fix anything the build or smoke test surfaces before finishing.

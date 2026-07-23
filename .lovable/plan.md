## Situation

- `bun run build` and `bunx tsgo --noEmit` both pass on the current code.
- Cloudflare preview logs show every request (including `/favicon.ico`) returning HTTP 500 with `Error: Disallowed operation called within global scope`, from preview SHA `516d5584`. That error is the Worker's top-level init failing — once the module fails to initialize, every route (matched or not) 500s.
- All 4 routes already have `ssr: false`, and the heavy stage/field code is behind `React.lazy`, so the wired code should not be reachable at Worker module-init.
- No module-scope `setTimeout`/`Math.random`/`fetch` was found in project source. Vendor calls appear only inside functions.

The most likely explanation is simply that the fix has been committed but not yet republished — the preview URL still serves SHA `516d5584`. Secondary risk: a subtle module-init side effect we haven't spotted.

## Plan

1. **Republish and re-check logs.**
   - After publish, hit `/` and `/favicon.ico` on the preview URL.
   - Pull `stack_modern--server-function-logs` for the new SHA.
   - If both return 200, we are done.

2. **If the new SHA still 500s with the same message, harden module init.**
   Do all of these in one pass:
   - Ensure `src/routes/__root.tsx` has no module-scope side effects (only imports + component definitions).
   - Grep the full transitive import graph of `__root.tsx` for anything that runs at top level (timers, `Math.random`, `Date.now`, `fetch`, `new WebSocket`, `crypto.randomUUID`, `new URL(...).searchParams` on `import.meta.env`, etc.). Move any hit into a lazy initializer.
   - Verify `src/lib/error-capture.ts`, `src/start.ts`, and `src/server.ts` only register handlers and don't invoke I/O at module scope.
   - Confirm `src/routeTree.gen.ts` does not eagerly import any browser-only chunk; if it does, force `React.lazy` in the corresponding route file so its browser-only imports live inside a lazily loaded component chunk.
   - Rebuild and inspect `dist/server/index.mjs` + `dist/server/_ssr/*.mjs` for any top-level statement that calls an async op.

3. **Verify.**
   - Rebuild, republish, hit `/`, `/library`, `/discover`, `/favicon.ico`.
   - All should return 200 and the worker logs should be clean.

No user-visible UI changes are part of this plan — it's strictly a deploy/runtime fix.

## Current diagnosis

The failure is still a production startup error: the preview renders, while the deployed Worker fails before React can report a browser console or network error. Fresh published logs are currently empty, so the exact remaining module is **not yet confirmed**. The prior Supabase guard is present in source, but that alone has not resolved the deployed failure.

## Plan

1. **Reproduce the production runtime locally**
   - Generate the actual Worker production artifact and run it under the Cloudflare-compatible runtime, not Vite dev.
   - Request `/`, `/discover`, `/library`, `/remote/test`, and `/favicon.ico` to capture the first real stack trace.

2. **Trace the exact startup import**
   - Inspect the emitted server chunks and source map at the failing frame.
   - Identify which module performs forbidden global-scope I/O, timer creation, or random generation.
   - Check both remaining likely paths: global function middleware importing the browser Supabase module, and server route registration pulling client-only Reactor/media dependencies into the startup graph.

3. **Fix the import boundary, not the symptom**
   - Move the confirmed client/runtime initialization behind browser-only dynamic imports or request-scoped server handlers.
   - If the auth attacher remains in the server graph, remove its module-scope browser-client import entirely and load the client only inside the browser middleware branch.
   - Keep the existing custom SSR error wrapper and avoid another broad `manualChunks` workaround.

4. **Verify the production artifact**
   - Re-run all routes through the production Worker path and confirm normal HTML/status responses.
   - Confirm the emitted server startup graph contains no eager browser SDK initialization.
   - Run focused browser checks to ensure authenticated server functions still attach bearer tokens on the client.

5. **Scan, publish, and check fresh logs**
   - Run the security scan, publish the verified artifact, then test both `zaplive.lovable.app` and `live.5-dee.com`.
   - Confirm fresh production logs no longer contain `Disallowed operation called within global scope` or a generic startup 500.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>
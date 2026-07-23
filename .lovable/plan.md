## Confirmed diagnosis

**Do I know what the issue is? Yes.** The route files are now correctly lazy, but the production bundler is still merging React—the runtime required by every server request—into the same generated vendor chunk as Reactor and Hugging Face Transformers.

The built server entry proves the startup path:

```text
server entry
  → generated server handler
  → generated router
  → React runtime
  → @reactor-models/happy-oyster vendor chunk
  → @huggingface/transformers vendor chunk
```

That vendor chunk is evaluated before request handling begins. Its browser-oriented dependencies perform initialization that the deployed Worker forbids at global scope, producing `Disallowed operation called within global scope` before any route can render. This explains why `ssr: false`, `.lazy.tsx`, and React.lazy improved route isolation but did not fix the deployed link.

## Implementation plan

1. **Create explicit production chunk boundaries**
   - Update `vite.config.ts` so React, React DOM, and Scheduler are emitted in an SSR-safe runtime chunk.
   - Keep Reactor, Happy Oyster, Hugging Face Transformers, MediaPipe, fal, Three.js, and cuelume in browser-only chunks.
   - Preserve the existing TanStack Start server entry and error wrapper.

2. **Verify the generated server startup graph**
   - Build the production artifact.
   - Confirm the main server entry and generated router can import React without evaluating Reactor, Transformers, MediaPipe, Three.js, fal, or cuelume.
   - Check that those dependencies remain behind lazy route/client imports.

3. **Validate routes using the production server artifact**
   - Test `/`, `/discover`, `/library`, `/remote/test`, and `/favicon.ico`.
   - Confirm page requests no longer return the generic 500 fallback and that existing client-side experiences still load.

4. **Publish and verify the actual Worker**
   - Run the required security check.
   - Publish the corrected build.
   - Re-test the published and custom-domain URLs and inspect fresh server logs for absence of `Disallowed operation called within global scope`.

5. **Fallback only if the artifact still co-locates dependencies**
   - Replace the affected Happy Oyster runtime imports with browser-only dynamic imports at the narrowest call sites, while preserving the current engine and presentation behavior.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>
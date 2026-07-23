## Confirmed diagnosis

**Do I know what the issue is? Yes.** The newly published Worker is still failing during module initialization with `Disallowed operation called within global scope`.

The production server bundle confirms the cause:

- `src/routes/index.tsx` statically imports `LandingHero`.
- `LandingHero` statically imports `LiquidEther`, `ASCIIText`, and `GhostCursor`.
- Those components statically import Three.js.
- The generated server route chunk therefore imports `dist/server/_libs/three.mjs` at startup.
- Three.js generates random values during module evaluation (`dist/server/_libs/three.mjs:1195–1198`), which the deployed runtime forbids outside a request handler.
- The same route chunk also eagerly imports MediaPipe and Hugging Face Transformers through the camera/depth modules.
- `ssr: false` prevents server rendering, but it does **not** prevent TanStack’s route tree from evaluating these static imports. That is why every page can fail before routing begins.

The current production logs confirm repeated instances of this exact error after the latest deployment.

## Implementation plan

1. **Create true lazy route boundaries**
   - Keep the critical files for `/`, `/library`, `/discover`, and `/remote/$sessionId` limited to route metadata/configuration.
   - Move each UI component into its corresponding `.lazy.tsx` route or a dynamically imported client component.
   - Use TanStack’s supported `createLazyFileRoute` pattern so the route tree no longer evaluates heavy presentation modules at Worker startup.

2. **Isolate browser-only dependencies from the server graph**
   - Ensure Three.js effects (`LiquidEther`, `ASCIIText`, `GhostCursor`, Prism), MediaPipe, Hugging Face Transformers/depth, fal realtime transport, Reactor SDK UI, audio, and camera code are reachable only from lazy client chunks.
   - Preserve all existing behavior and designs; this is an import-boundary correction, not a UI rewrite.

3. **Harden remaining initialization paths**
   - Keep MediaPipe model setup, timers, audio contexts, WebGPU/depth pipelines, realtime connections, and random session/UI values inside effects, user handlers, constructors, or explicit lazy getters.
   - Remove any remaining module-level initialization that the production server bundle reveals after route splitting.

4. **Verify the production artifact and runtime**
   - Confirm the server entry no longer imports Three.js, MediaPipe, Transformers, or other browser-heavy libraries from its startup route chunk.
   - Verify `/`, `/discover`, `/library`, `/remote/test`, and `/favicon.ico` no longer produce initialization failures.
   - Check the actual Worker logs for absence of `Disallowed operation called within global scope` before considering the fix complete.

5. **Publish the verified fix**
   - Run a security scan, publish the corrected build, and re-check the live URL and Worker logs after deployment.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>
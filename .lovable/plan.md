The pasted contents are again stripped of JSX and generics by markdown rendering (empty `Record` types, empty `<>` fragments, JSX bodies gone). All five files are affected: `AdventureControls.tsx`, `Screen.tsx`, `Sidebar.tsx`, `HappyOysterApp.tsx`, `SetupRequired.tsx`. Additionally `SetupRequired.tsx` is truncated mid-function (missing final `}`).

Plan: fetch each file verbatim from the upstream reference at `raw.githubusercontent.com/reactor-team/js-sdk/main/examples/happy-oyster/` using `curl` (proven-good source last turn for `button.tsx`), then write byte-for-byte to `src/components/happy-oyster/`. Apply the same minimal, already-established Next→TanStack port adjustments made in previous turns for the other happy-oyster components (strip `"use client"`, keep `@/…` imports pointing at the ported `src/lib/happy-oyster/*` and `src/components/happy-oyster/*` paths). No restyling, no shadcn adaptation, no feature changes.

Files to write:
1. `src/components/happy-oyster/AdventureControls.tsx`
2. `src/components/happy-oyster/Screen.tsx`
3. `src/components/happy-oyster/Sidebar.tsx`
4. `src/components/happy-oyster/HappyOysterApp.tsx`
5. `src/components/happy-oyster/SetupRequired.tsx`

Then run typecheck/build and report result verbatim.
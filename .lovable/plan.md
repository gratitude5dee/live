
# Frontend polish — React Bits integration

Elevate the landing surface at `/` with four React Bits components. The current stage UI (camera, transport, gestures) stays intact; we're wrapping it behind a cinematic entry screen and upgrading its chrome.

## What the user sees

1. Land on `/` → full-viewport **Iridescence** shader background, animated **Strands** ribbon centerpiece, hero copy "ZAP-LIVE — your webcam is the timeline", and a single **GlassSurface** button labeled **"Zap Live"**.
2. Click **Zap Live** → the hero fades out and the existing stage card ("your webcam is the timeline" / camera + prompt dock) mounts and starts the session.
3. Every primary CTA inside the stage (Apply, Record, Snapshot) uses **SpecularButton** for a consistent specular-edge language.

## Files to add

```
src/components/reactbits/
  GlassSurface.tsx          + GlassSurface.css
  Strands.tsx               + Strands.css
  Iridescence.tsx           + Iridescence.css
  SpecularButton.tsx        + SpecularButton.css
src/components/zap/
  LandingHero.tsx           # Iridescence + Strands + hero copy + Zap Live CTA
```

## Files to modify

- `src/routes/index.tsx` — add `entered` state; when false render `<LandingHero onEnter={() => setEntered(true)} />`; when true render existing stage (unchanged logic). Move `startSession()` to fire on enter instead of mount so camera prompts only appear after user gesture (also fixes autoplay UX).
- Replace primary action buttons in the stage dock (Apply, Record, Snapshot, Undo) with `SpecularButton` wrappers, keeping current handlers/labels/shortcuts. Secondary chips and preset rail stay as-is.
- `package.json` — add `ogl` dependency (used by Strands, Iridescence, SpecularButton).

## Technical notes

- All four components are JS + WebGL/SVG. Convert to `.tsx` with minimal typing (`children?: React.ReactNode`, prop types from the docs). No behavior changes to the source shaders.
- `ogl` is browser-only. LandingHero and SpecularButton must not run in SSR: gate the WebGL mounts with a `useHydrated()` check or `typeof window` inside `useEffect` (already the case — they instantiate `Renderer` inside `useEffect`, so safe).
- `GlassSurface` uses SVG `<feDisplacementMap>` + `backdrop-filter: url(#...)`. Chrome supports it; Safari/Firefox fall back to the CSS `--fallback` class (already handled by the component). No extra work.
- The provided CSS uses `-webkit-backdrop-filter` alongside `backdrop-filter` — per project rule (tailwind4-backdrop-filter), strip the `-webkit-` duplicates from the copied CSS to avoid Lightning CSS dropping the standard property in production.
- Iridescence background is fixed `inset-0 -z-10 pointer-events-none` behind the hero only (unmounts when `entered === true` to free GPU).
- Strands rendered at ~600×400 centered above the headline, `glass={false}`, default palette tuned toward the app's electric/live feel: `["#22d3ee","#a855f7","#f43f5e","#eab308"]`.
- GlassSurface "Zap Live" button: `width={220} height={64} borderRadius={32}`, inner content is a `<button>` with text + a nested arrow-in-circle (per project's Button-in-Button design rule). Click handler calls `onEnter`.
- SpecularButton default `size="md"`, `followMouse`, `autoAnimate={false}` — shine only reacts on cursor proximity so it doesn't distract from live video.

## Risks / non-goals

- Do NOT touch fal-transport, gesture-engine, face-engine, vision-buffer, Supabase wiring, or route data flow.
- Do NOT restyle the `/library` or `/remote/$sessionId` routes in this pass (can follow up).
- WebGL contexts: three canvases (Iridescence, Strands, one SpecularButton per CTA). Landing unmounts Iridescence+Strands on enter, and SpecularButtons live only inside the stage — total ≤ 5 GL contexts, safely under the browser limit.

## Verification

- `bun add ogl`, typecheck passes, build passes.
- Preview: landing renders shader + strands + glass CTA; click enters stage; camera prompt appears after click; SpecularButtons render with rim highlight on hover.
- Test in Chrome (SVG glass path) and Safari (fallback path) — both look premium.

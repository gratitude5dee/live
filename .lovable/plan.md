# Plan: Swap hero headline for animated ASCIIText "Zap!"

## Changes

1. **New component** `src/components/reactbits/ASCIIText.tsx`
   - Port the provided JS component to TSX (`// @ts-nocheck` for shader glue).
   - `three` is already installed — no new deps.
   - Fix the broken snippet: source has a truncated `return (...)`. Restore proper JSX: `<div ref={containerRef} className="ascii-text-container">` with the `<style>` tag inside.
   - Font loading: instead of the source's inline `@import` inside `<style>` (which is fine at runtime — it's a browser-parsed style block, not Lightning CSS), add IBM Plex Mono via a `<link>` tag in `src/routes/__root.tsx` head to preload cleanly. Keep the inline `<style>` for the container-scoped canvas/pre CSS only.

2. **`src/components/zap/LandingHero.tsx`** — replace the `<h1>Your webcam is the timeline.</h1>` block with a fixed-height container hosting `<ASCIIText text="Zap!" enableWaves asciiFontSize={8} planeBaseHeight={8} />`. Keep the eyebrow, subcopy, CTA, and Strands untouched.
   - Container: `relative z-10 h-[280px] md:h-[360px] w-full max-w-4xl` so the ASCII canvas has real width/height (it measures via `getBoundingClientRect`).
   - Add `sr-only` H1 with "Zap Live — realtime video editor" for SEO/a11y since ASCIIText is canvas-only.

3. **`src/routes/__root.tsx`** — add IBM Plex Mono preconnect + stylesheet link (weights 500;600).

## Guardrails
- Frontend only. No changes to session/transport/DB.
- Keep hero vertical rhythm — ASCIIText slot sized so the CTA doesn't reflow.

## Changes

1. **Update tagline copy** in `src/components/zap/LandingHero.tsx`
   - Replace: `A realtime streaming video editor. Prompt, gesture, or reference — Lucy 2.5 repaints every frame in under a second.`
   - With: `Create your reality in realtime with Zap! Built for streamers, digital shop sellers, and wizards looking to bend their reality.`

2. **Add GhostCursor component** as a site-wide cursor effect on the homepage
   - Create `src/components/reactbits/GhostCursor.tsx` (verbatim from the spec, converted with proper TS-friendly JSX)
   - Create `src/components/reactbits/GhostCursor.css` (verbatim)
   - Mount it in `LandingHero.tsx` as a full-viewport fixed overlay wrapper so the ghost trail follows the cursor across the whole landing page (above LiquidEther background, below interactive content). Use `position: fixed; inset: 0; pointer-events: none; z-index: 40` on the wrapper, and pass the spec's default props (color `#B497CF`, brightness `1`, trailLength `50`, inertia `0.5`, bloom + grain defaults, `mixBlendMode: 'screen'`).

3. `three` is already installed — no new dependencies.

No changes to `/` route logic, session flow, or Lucy transport.

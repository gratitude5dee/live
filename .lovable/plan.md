## Goal
Replace the current "Modes" grid with the React Bits **InfiniteMenu** (WebGL sphere of orbiting tiles), apply a **ShinyText** treatment to the primary text across the landing page, and tighten mobile responsiveness across the hero + sections.

## Changes

### 1. New reusable components
- `src/components/reactbits/InfiniteMenu.tsx` + `InfiniteMenu.css` — port the provided JS component to TSX. Uses `gl-matrix` (install via `bun add gl-matrix`). Keeps the WebGL2 sphere, arcball control, atlas texture loader, and active-item callback. Root container gets a fixed height (e.g. `h-[560px] md:h-[640px]`) and full width so the canvas has size.
- `src/components/reactbits/ShinyText.tsx` + `ShinyText.css` — port the provided motion-based shiny gradient text (`motion` already installed via `framer-motion`; if not, install `motion`).

### 2. Rebuild `src/components/zap/ModesSection.tsx`
- Remove PixelCard grid + active caption row.
- Feed the existing 6 MODES into `InfiniteMenu` as `{ image, title, description, link: "#" }` items.
- Layout:
  - Section heading "Modes" + subhead rendered with `ShinyText`.
  - Below: a full-width container holding `<InfiniteMenu items={...} scale={1} />` sized responsively (`h-[520px] sm:h-[600px] lg:h-[680px]`).
- Keep the top/bottom fades and dark background so it blends with the rest of the page.
- Since the built-in overlay title/description is hidden under 1500px by the component CSS, add a React-side caption **beneath** the canvas that mirrors the currently-active item (wire via an `onActiveItem` callback prop we expose from InfiniteMenu). Caption text uses `ShinyText`.

### 3. ShinyText rollout (text only, no structural changes)
Apply `ShinyText` to the marquee copy so the effect is felt but not overwhelming:
- `LandingHero.tsx`: the tagline paragraph ("Create your reality in realtime with Zap!…") and the small section eyebrows.
- `ChooseReality.tsx`: the "Choose your reality" heading + supporting line.
- `ModesSection.tsx`: the "Modes" heading, subhead, and active-mode caption.
- Body microcopy and buttons stay untouched to preserve legibility.
Defaults: `color="#8a8f98"`, `shineColor="#ffffff"`, `speed={4}`, `spread={140}`.

### 4. Mobile optimization pass
Audit and adjust with the responsive-layout rules (grid + `min-w-0` + `shrink-0`):
- `LandingHero.tsx`: reduce ASCIIText scale on mobile, stack the CTA + menu vertically, ensure the tagline uses `text-base sm:text-lg` and `px-6` gutters, keep BubbleMenu inside safe-area on small screens.
- `ChooseReality.tsx`: OptionWheel column becomes full-width above the 9:16 preview on `<md`; preview card gets `max-w-[min(340px,80vw)]`.
- `ModesSection.tsx`: InfiniteMenu height scales down (`h-[440px]` on mobile), caption becomes `text-sm` with tighter line-height.
- Global: verify `GhostCursor` is disabled or lightened on touch devices (pointer-coarse media query) to avoid jitter.

## Technical notes
- Install: `bun add gl-matrix` (and `motion` if not already resolvable — otherwise re-use `framer-motion`'s `motion` export by adjusting the import path).
- InfiniteMenu ported to TSX: type items as `{ image: string; link?: string; title?: string; description?: string }`, expose optional `onActiveItem?: (item) => void` prop so the parent can render captions outside the built-in overlay.
- Keep original JSX overlay markup intact but rely on the CSS media query (`max-width: 1500px`) that hides internal title/description on smaller screens; our external caption covers mobile + laptops.
- No backend, schema, or route changes.

## Files touched
- add: `src/components/reactbits/InfiniteMenu.tsx`, `InfiniteMenu.css`, `ShinyText.tsx`, `ShinyText.css`
- edit: `src/components/zap/ModesSection.tsx`, `src/components/zap/LandingHero.tsx`, `src/components/zap/ChooseReality.tsx`
- deps: `bun add gl-matrix` (+ `motion` if missing)

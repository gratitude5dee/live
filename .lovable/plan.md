## Problems in current "Modes" section

- `CircularGallery` (WebGL) rotates labels with the ring so text ends up tilted and colliding with adjacent cards.
- Cards bleed into each other with no spacing/hit targets, and the section eyebrow ("MODES" title with gradient headline) is missing — the screenshot shows just tilted images.
- No hover interaction on the cards.

## Fix

Replace the WebGL `CircularGallery` with a clean, static 3-up (desktop) / 1-up (mobile) grid of `PixelCard`s. Keep the six MODES data and captions.

### 1. Add PixelCard component (verbatim from spec, TS-safe)
- `src/components/reactbits/PixelCard.tsx`
- `src/components/reactbits/PixelCard.css`
- Override the fixed 300×400 / `border-radius: 25px` / dark-only defaults from the spec CSS with a scoped modifier so the card fills its parent (`.pixel-card.pixel-card--fill { width: 100%; height: 100%; aspect-ratio: auto; border-radius: inherit; }`) — leaves the shipped component API untouched.

### 2. Rebuild `ModesSection.tsx`
- Keep the section shell, eyebrow "Modes", gradient headline "Every reality has a lever.", and intro copy.
- Replace the full-bleed WebGL strip with a Double-Bezel grid:
  - Outer wrapper: `mx-auto max-w-6xl px-6`
  - Grid: `grid gap-6 md:grid-cols-2 lg:grid-cols-3` (single-column on mobile per the design-craft mobile override).
  - Each card:
    - Outer shell (Doppelrand): `rounded-[2rem] p-1.5 bg-white/[0.04] ring-1 ring-white/10`
    - Inner core: `rounded-[calc(2rem-0.375rem)] overflow-hidden bg-[#0a0a0a] aspect-[4/5]`
    - Inside the core: `PixelCard` filling the surface with `variant` cycling through `"blue" | "pink" | "yellow" | "default"` for variety, then the mode image as a background `<img>` (`absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03]`), a bottom gradient scrim, and a bottom-left label block (`Object Add-In`, `01 / 06` eyebrow).
    - Wrapper has `group` so pixel canvas + image both respond to hover; `PixelCard`'s own mouseenter/leave already drives the shimmer.
  - Cards are click/tab-selectable and update the caption row below (`setActive(i)`).
- Caption row below the grid keeps the existing `01 / 06` eyebrow + `text` + `description` (with the `key={active}` fade-in), unchanged.

### 3. Cleanup
- Remove the `CircularGallery` import from `ModesSection.tsx`.
- Leave `src/components/reactbits/CircularGallery.tsx` in the tree (still used nowhere else, harmless — not deleting to avoid touching unrelated code).

No changes to `LandingHero.tsx` beyond keeping `ModesSection` mounted where it already is.

## Result

- Cards are upright, evenly spaced, and legible with proper labels.
- Hovering any card triggers the PixelCard shimmer overlay behind the image while the image gently scales.
- Section flows into the "Choose your reality" rhythm above it.

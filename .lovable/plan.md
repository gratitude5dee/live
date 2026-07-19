# /library — Editorial Redesign

Elevate `/library` from "grid of cards on a blurry background" to a proper archive experience with editorial density, physical depth, and cinematic motion. Keep all functionality (Feed / Grid / List, multi-select, ZIP, delete).

## Direction: "Cinema Archive"

Vibe: **Ethereal Glass** (deep OLED `#050505`, subtle warm glow) meets editorial museum wall. Massive display type, monospace metadata, hairline dividers, obsessive whitespace, one accent (cyan → warm amber shift on hover). LiquidEther retreats to a fixed low-opacity ambient behind everything.

## What changes

### 1. Header / hero (top of page)
- **Sticky floating nav pill** replaces the current edge-to-edge header. `mt-6 mx-auto w-max rounded-full` glass pill: WZRD logo · `Library` label · `← Stage` button-in-button with nested circular arrow.
- **Editorial hero band** (`py-24 md:py-32`):
  - Eyebrow: `[ 001 / ARCHIVE ]` monospace, `text-[10px] tracking-[0.32em]` in `white/50`.
  - Display headline: `Your takes` in a heavy display face (via `ShinyText`) at `clamp(3.5rem, 10vw, 8rem)`, `-tracking-[0.04em]`, `leading-[0.9]`.
  - Right-aligned inline stat block on desktop: `24 videos · 3.2 GB · latest 2m ago` in mono, sits on the same baseline as the H1 (asymmetric split).
  - Subhead one line, `max-w-[52ch]`, `text-white/55`.

### 2. Filter + view toggle bar
- Replace pill buttons with an **underlined tab rail** (Linear-style): text labels with animated underline sliding between active tab; count is small superscript, not a chunky pill.
- View toggle becomes a **segmented control in a double-bezel shell** (outer `bg-white/[0.04] ring-1 ring-white/10 p-1 rounded-full`, inner active pill `bg-white text-black` with `mix-blend-difference` icon). Icons swap Lucide→Phosphor-style hairlines: play triangle / grid dots / horizontal lines.
- Bar becomes sticky under the nav on scroll with backdrop-blur and a hairline bottom border that appears only when scrolled.

### 3. Grid view — "museum wall"
- Switch to an **asymmetric bento**: repeating pattern of `col-span-2 row-span-2` hero tile + four `col-span-1` tiles (masonry-feel on lg+, plain grid on md, single column on mobile).
- Every card is a **double-bezel**: outer `p-1.5 rounded-[2rem] bg-white/[0.03] ring-1 ring-white/10`, inner `rounded-[calc(2rem-6px)] ring-1 ring-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`.
- Meta strip moves **inside** the media as a bottom-anchored glass bar that lifts on hover (`translate-y-2 group-hover:translate-y-0`, `opacity-0 group-hover:opacity-100`, `cubic-bezier(0.32,0.72,0,1)` 500ms).
- Kind badge redesigned: small square chip, no gradient, mono uppercase, tinted only via a 2px left accent bar.
- Select checkmark: floats top-right in its own circular double-bezel; when selected, the whole card gets an inset accent ring and a slight `scale-[0.98]` press.
- Hover: card lifts (`-translate-y-1`), inner shadow deepens, corners get a spotlight border (radial gradient tracking cursor via CSS-only `--x/--y` custom props).

### 4. List view — "archive ledger"
- Reformat as a monospace ledger: `INDEX · PREVIEW · FILENAME · KIND · CREATED · DURATION · SIZE · ⋯` with `text-[11px] uppercase tracking-[0.24em]` header.
- Row height `72px`, hairline `border-b border-white/[0.06]`, hover shows a `2px` accent bar on the left edge (`before:` pseudo, scales-x on hover).
- Preview thumbnail becomes a `56×72` double-bezel with a subtle inner glow when video.
- Numeric columns use `font-variant-numeric: tabular-nums`.
- Master checkbox becomes a custom minus/check morph.

### 5. Feed view — "cinema mode"
- Currently constrained to `max-w-md` — too tight and boxed. Rebuild as a **letterboxed cinema deck**:
  - Full-viewport container `h-[100dvh]` with `mx-auto max-w-[420px]` on desktop, framed by two decorative side rails showing the previous/next take at 30% opacity + blur (peek).
  - Backdrop is a heavily-blurred, saturated version of the active video (`::before` pseudo-element with the same `<video>` via canvas snapshot or CSS `filter: blur(80px) saturate(1.6)`) — TikTok-style ambient light.
  - Slide indicator: vertical dot column on the far left with active dot morphing into a progress bar for the currently-playing video.
  - Right rail action buttons redesigned as circular double-bezels, `w-12`, with hairline separators between them. Icons: hairline stroke, no emoji. Labels appear on hover as tiny mono captions to the left.
  - Filename + meta anchored bottom-left in a subtle glass strip with a 2px accent underline.
  - Auto-hide chrome after 2s of no interaction; wake on mousemove/tap.

### 6. Multi-select bulk bar
- Redesign as a **floating command bar** (Linear cmd-k style): rounded-[1.75rem], double-bezel, split into: `count chip | Download | ZIP (primary, filled accent) | Delete (ghost danger) | ⌘Z Clear`.
- Slide-up entry animation with spring easing; auto-dismisses on `Esc`.
- Keyboard hints (`⌘A` select all, `⌫` delete, `⌘D` download) shown as tiny kbd chips beside each action.

### 7. Empty state
- Redesign as an **archive plate**: giant faded `000` numeral behind, "The archive is empty." headline, one-line copy, single CTA using the button-in-button pattern with a nested arrow circle.

### 8. Loading skeletons
- Match the bento pattern with the same double-bezel shell; add a slow horizontal shimmer keyframe (`translate-x` on a gradient bar, not opacity blink).

### 9. Ambient / background
- Reduce LiquidEther opacity to 0.25 and shift toward warm palette (`#f5c26b`, `#22d3ee`, `#e879f9`) so it reads as gallery lighting, not screen-saver.
- Add a fixed `pointer-events-none` grain overlay (SVG turbulence, `opacity-[0.035]`, `mix-blend-overlay`).
- Add a soft top-left warm radial glow behind the hero (`radial-gradient(circle at 15% 10%, rgba(245,194,107,0.08), transparent 40%)`).

### 10. Motion + micro-interactions
- All transitions use `cubic-bezier(0.32,0.72,0,1)` at 400–700ms.
- Hero + section entries use `IntersectionObserver` for a `translate-y-8 blur-sm opacity-0` → resolved reveal with 60ms stagger.
- Buttons scale to `0.97` on active; nested icon circles translate `x-0.5 -y-0.5` on group-hover.
- Feed slide changes trigger a 350ms cross-fade of the ambient backdrop.
- Motion respected: wrap all animation in `@media (prefers-reduced-motion: no-preference)` guards.

### 11. Typography
- Load `Geist` (display) + `Geist Mono` (metadata) via `<link>` in `__root.tsx` head. No Inter.
- Headline uses `Geist` at heavy weight with tight tracking. Metadata (filenames, sizes, timestamps, index numbers) all `Geist Mono`.
- Body copy retains current stack.

### 12. Color tokens
Add to `src/styles.css`:
- `--archive-bg: #050505`
- `--archive-surface: color-mix(in oklab, white 4%, transparent)`
- `--archive-hairline: color-mix(in oklab, white 10%, transparent)`
- `--archive-accent: #f5c26b` (warm amber)
- `--archive-accent-cool: #22d3ee` (kept for select state)
- Shadow tokens: `--shadow-plate` (inset highlight), `--shadow-lift` (tinted amber drop).

## Files touched

- `src/routes/library.tsx` — full component-level redesign. Extract into small internal components (`LibraryNav`, `LibraryHero`, `FilterRail`, `ViewSegmented`, `BentoGrid`, `LedgerList`, `CinemaFeed`, `CommandBar`, `EmptyPlate`, `SkeletonBento`).
- `src/styles.css` — add archive color tokens + shimmer/reveal keyframes + grain overlay class.
- `src/routes/__root.tsx` — add Geist + Geist Mono `<link>` (only if not already present).
- No new dependencies. Reuses `client-zip`, `LiquidEther`, `ShinyText`, `GlassSurface`.

## Out of scope

- Per-user tags, folders, renaming, favoriting persistence.
- Server-side pagination (still capped at 120).
- Video trimming / editing.

## Success bar

- Reads as a $150k archive product, not a template gallery.
- Nothing generic: no default Lucide feature icons on primary controls, no gray 1px borders, no plain black background, no equal-column feature strip, no square pill filter chips.
- Feed feels like TikTok + Apple Photos Cinematic — not a boxed video in the middle of the page.
- Fully responsive: bento collapses to single column below 768px; feed remains full-viewport; ledger horizontally scrolls only its interior columns, never the page.
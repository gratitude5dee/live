## BubbleMenu + "Choose your reality" section

Two additions to `src/components/zap/LandingHero.tsx`:

### 1. BubbleMenu (top-left, black + specular)
New files:
- `src/components/reactbits/BubbleMenu.tsx` — port the JS source to TSX, typed props, GSAP-driven overlay + hamburger→X morph (dependency `gsap` already present, verify with `bun add gsap` if not).
- `src/components/reactbits/BubbleMenu.css` — the provided CSS, tweaked for our dark theme (see overrides below).

Overrides:
- Logo bubble + toggle bubble backgrounds → `#000` with a subtle white hairline ring and the same specular highlight the CTA uses (inset white gradient + soft outer glow). Menu lines → white.
- Overlay pill background stays light so labels stay legible; only the two top bubbles are black.
- `useFixedPosition` = true so it stays pinned during scroll.
- Logo slot = `wzrdLogo.url` inside the black pill.
- Items: Live, Library, Presets, Remote, About (routes to `/`, `/library`, `#presets`, generated remote QR modal, external).

Placement:
- Render `<BubbleMenu … />` at top of `LandingHero.tsx` (before LiquidEther wrapper), remove the existing centered brand lockup so the logo only lives in the menu bubble.

### 2. "Choose your reality" section (OptionWheel)
New files:
- `src/components/reactbits/OptionWheel.tsx` — port JS to TSX.
- `src/components/reactbits/OptionWheel.css` — verbatim.

New section component `src/components/zap/ChooseReality.tsx`:
- Full-width dark section under the hero (add inside `LandingHero.tsx` after the hero container, still inside the same page so the LiquidEther bg continues).
- Loads presets from Supabase (same `.from("presets").select(...)`), sorted by `sort_order`, filtered to rows with `thumbnail_url` (the 6 new image presets).
- Left half: `<OptionWheel items={preset.name[]} side="left" activeColor="#22D3EE" textColor="#4B5563" />` with `onChange` updating selected index.
- Right half: large 9:16 preview card showing the selected preset's `thumbnail_url` with the emoji badge, name headline, and prompt text truncated. CTA "Zap this reality" calls `onEnter` (same handler as the hero button, but sets a pending preset in `sessionStorage` so `src/routes/index.tsx` can auto-apply it once Lucy connects).
- Auto-apply hook: in `src/routes/index.tsx`, after `startRecording(true)` succeeds (Lucy live), read `sessionStorage.pendingPresetId`, find in `presets`, call `applyPreset`, clear the key.

Section heading: "Choose your reality" — massive display type, eyebrow tag "Presets".

### 3. Small type fix
Extend `LandingHeroProps` — no changes needed; the CTA already receives `onEnter`. `ChooseReality` reuses it.

### Technical notes
- BubbleMenu uses GSAP; verify `gsap` is installed (add if missing).
- Black + specular for the two bubbles: `background: radial-gradient(120% 120% at 30% 20%, #1a1a1a 0%, #000 55%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08);`
- OptionWheel is client-only (uses window/rAF) — safe in this component since LandingHero is only rendered in the client-side route.
- No schema changes; reuses the 6 image presets already seeded.

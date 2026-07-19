## Add Prism-powered footer to homepage

Build a cinematic site footer anchored by the React Bits `<Prism />` WebGL component, WZRD logo, footer nav, and legal row. Mount it at the bottom of the landing page.

### Files

1. **`bun add ogl`** — new dependency for the Prism shader.
2. **`src/components/reactbits/Prism.tsx`** — port the provided JSX to TSX with typed props (`animationType: 'rotate' | 'hover' | '3drotate'`, optional `offset`, etc.). Same shader logic, same cleanup.
3. **`src/components/reactbits/Prism.css`** — the provided `.prism-container` rule.
4. **`src/components/zap/SiteFooter.tsx`** — new footer component:
   - Full-bleed section, ~420px tall desktop / ~520px mobile, black background, `overflow-hidden`.
   - Prism mounted absolutely behind content: `animationType="3drotate"`, `timeScale={0.4}`, `scale={3.2}`, `glow={1}`, `noise={0.35}`, `hueShift={-0.2}` (blue tint to match WZRD chrome), `suspendWhenOffscreen` on.
   - Foreground grid (max-w container, backdrop blur pill sections):
     - **Left**: WZRD chrome logo (reuse existing asset) + tagline "Bend your reality." wrapped in `ShinyText`.
     - **Middle columns**: three link groups — **Product** (Stage, Presets `#choose-reality`, Modes `#modes`), **Company** (About, Contact `mailto:`, Twitter/X), **Legal** (Privacy, Terms). Anchor links for on-page sections, `<a>` for external, all styled with `ShinyText` on hover.
     - **Right**: small "Powered by Lucy 2.5 · fal.ai" caption.
   - Bottom row: `© 2026 WZRD.tech` + build tag, separated by a hairline top border (`border-white/10`).
   - Mobile: stack columns vertically, keep Prism height compact, disable prism on `prefers-reduced-motion` (render static gradient fallback).
5. **`src/routes/index.tsx`** — import and render `<SiteFooter />` at the bottom of the landing view (after `ModesSection`, only in the pre-session landing state so it doesn't clutter the live Stage). Add ids `choose-reality` and `modes` to those sections so footer anchors work.

### Notes

- No backend/schema changes.
- Uses existing `ShinyText`, WZRD logo asset, and design tokens; no hardcoded hex outside the Prism shader tuning props.
- `suspendWhenOffscreen` avoids GPU cost when the footer is scrolled away, keeping the <100ms live-loop budget on the Stage.

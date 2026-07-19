# Plan: Elevate "Choose Your Reality" + add "Modes" section

## 1. Redesign `ChooseReality` section

Current issues visible in screenshot:
- OptionWheel labels bleed off the left edge and collide with the BubbleMenu.
- Gradient headline ("Hooded Windbreaker") gets clipped.
- Layout feels unbalanced — wheel on left, preview floating far right, empty middle.
- No section header/eyebrow — user doesn't know what this section is.

Redesign (frontend only, `src/components/zap/ChooseReality.tsx` + CSS):
- Add a proper section shell: eyebrow tag ("01 — REALITIES"), massive H2 "Choose your reality.", short subcopy. Generous `py-32` breathing room.
- Two-column split with safe gutters (`px-8 lg:px-16`, wheel column starts well clear of the BubbleMenu — `pl-32` on lg).
- Wheel column: constrain OptionWheel to a fixed inner width, mask fade top/bottom, ensure selected label truncates with ellipsis rather than clipping. Replace raw gradient text with a tighter "Double-Bezel" active-item chip so long names ("Hooded Windbreaker") stay contained.
- Preview column: keep the 9:16 double-bezel card, but frame it inside a nested aluminum shell (outer `rounded-[2.5rem] ring-1 ring-white/5 bg-white/[0.02] p-2`, inner `rounded-[calc(2.5rem-0.5rem)]`). Add a soft radial glow behind the card driven by the selected preset's dominant color.
- CTA: replace plain "Zap this reality" pill with the button-in-button pattern (pill + nested circular arrow), plus a secondary ghost "Shuffle" that spins the wheel.
- Motion: fade/blur-up entry via IntersectionObserver, custom cubic-bezier transitions on card swap, magnetic hover on CTA.

## 2. New "Modes" section (below Choose Your Reality)

Purpose: let users browse the *kinds of edits* Lucy can do (object add-in, character switch, background switch, style transfer, weather/time shift, lighting/mood). Selection is presentational only for now — no wiring into the live prompt pipeline unless requested later.

Files:
- `src/components/reactbits/CircularGallery.tsx` + `CircularGallery.css` — copy component source verbatim (JS→TSX with minimal typing, or keep as `.jsx`). Uses existing `ogl` dep (already installed).
- `src/components/zap/ModesSection.tsx` — section wrapper.
- `src/components/zap/LandingHero.tsx` — mount `<ModesSection />` below `<ChooseReality />`.

Section layout:
- Eyebrow "02 — MODES", H2 "Every reality has a lever.", one-line subcopy.
- Full-bleed `CircularGallery` at ~600px height with `bend={3}`, `borderRadius={0.05}`, `textColor="#ffffff"`, custom Orbitron/Geist font via `fontUrl`.
- Items (6): Object Add-In, Character Switch, Background Switch, Style Transfer, Weather Shift, Lighting Mood — each with a curated cover image (reuse existing preset thumbnails from Supabase where relevant, plus 2–3 new picsum/unsplash seeds).
- Below the gallery: a live-updating caption row (mode name + short description) tied to a lightweight state hook. Keep it purely visual — no DB writes.

## 3. Guardrails

- Frontend/presentation only. No schema, no server functions, no changes to `fal-transport` or `routes/index.tsx` pipeline.
- Reuse existing design tokens in `src/styles.css`; no hardcoded colors.
- Verify OptionWheel no longer clips by taking a Playwright element screenshot of the section post-change.

## Technical notes

- CircularGallery uses `ogl` (already in deps). Wrap in `<ClientOnly>`-equivalent guard (`useEffect` mount + `typeof window` check inside the component's effect — the source already gates on `containerRef.current`, so a dynamic `React.lazy` import from the section is enough).
- The provided source has an empty `return ( … )` — must add `<div ref={containerRef} className="circular-gallery" tabIndex={0} />` when copying.
- Font URL: load Orbitron via the component's `fontUrl` prop; no `@import` in `styles.css` needed.

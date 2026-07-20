## Install cuelume + wire tasteful UI SFX across ZAP-LIVE

Cuelume gives us 14 synthesized sounds with a `data-cuelume-*` API and an imperative `play()`. Goal: use it sparingly to reinforce moments the user *caused* (hover on marquee CTAs, presets applied, takes ready, errors) — never on the live-stage HUD where MediaPipe/voice already carry the feedback loop. Runs entirely client-side; SSR imports are no-ops.

### 1. Install & bootstrap
- `bun add cuelume`.
- New `src/lib/sfx.ts`: thin wrapper around cuelume with:
  - `initSfx()` → calls `bind()` once + reads `localStorage['zap.sfx']` (default: on) and applies `setEnabled(...)`.
  - `setSfxEnabled(on: boolean)` → persists + `setEnabled`.
  - `useSfxEnabled()` React hook returning `[enabled, setEnabled]`.
  - Re-exports typed `play(name)`.
- Call `initSfx()` from a top-level `useEffect` in `src/routes/__root.tsx` (after hydration guard so it's client-only).

### 2. Persistent mute toggle
- Add a small speaker icon button in `BubbleMenu` (top-left cluster) — same specular styling as the logo pill. Reads `useSfxEnabled()`, toggles + plays `toggle` on activation. Tooltip: "Sound FX".
- Muted state stored per-user in `localStorage`; respects `prefers-reduced-motion` → default off when set (users who reduce motion often want reduced audio too).

### 3. Landing page (`LandingHero`, `ChooseReality`, `ModesSection`, `SiteFooter`) — declarative
Restraint is the point. Only marquee elements get sound:
- **Primary CTA "Computah! Activate"** → `data-cuelume-hover="bloom"` + `data-cuelume-press="press"` + `data-cuelume-release="release"`. Feels like arming a mic.
- **BubbleMenu nav pills** → `data-cuelume-hover="tick"` (crisp, quiet). Cuelume already throttles hover to 1/150ms so a menu sweep stays calm.
- **OptionWheel / ChooseReality option cards** → `data-cuelume-toggle="toggle"` on selection (mechanical click-clack matches the wheel metaphor).
- **PixelCards in ModesSection** → `data-cuelume-hover="chime"` (only on fine-pointer devices per cuelume's own guarantee).
- **InfiniteMenu items** → `data-cuelume-hover="sparkle"` when a new item snaps into center (imperative from the existing snap callback, not declarative, so it fires once per snap not per pointer move).
- **Prism/Footer** → no sound. Ambience only.

### 4. Live stage (`DesktopStage`, `MobileStage`) — imperative only, outcome-driven
No hover/press sounds on the stage. Every sound corresponds to a real state change:
- **Session connects (Lucy first frame)** → `play("ready")`.
- **Session ends / disconnect** → `play("droplet")`.
- **Preset applied successfully** → `play("success")` (from existing `applyPreset` after Lucy send).
- **Template preset opens image picker** → `play("bloom")`.
- **Reference image uploaded & applied** → `play("success")`; **cleared** → `play("droplet")`.
- **Recording auto-start** → `play("loading")`; **recording stop + take ready** → `play("ready")`.
- **Prompt applied via text/voice** → `play("tick")` (very subtle — reinforces the wake-word ack alongside the HUD flash).
- **Voice wake ("Computah" detected)** → `play("sparkle")` on the client-side ACK path.
- **Gesture fired (`onFire` in gesture engine)** → `play("toggle")` — mechanical feedback that pairs the ⌘/hand shortcut.
- **Face reactive triggers (snapshot/confetti/etc.)** → `play("sparkle")`.
- **Camera flip** → `play("page")` (papery flick suits the reversal).
- **Depth toggle on** → `play("bloom")`; **off** → `play("droplet")`.
- **Any `toast.error(...)`** → `play("error")` via a small wrapper (`toastError()` in `src/lib/sfx.ts`) used at existing error call sites; leaves untouched toasts silent.

Explicitly **NOT** sonified on stage: prompt keystrokes, HUD hover, PiP badges, gesture live-update ticks, sub-second heartbeat toasts, latency changes. The stage already lives in a soundscape (mic + Lucy) — SFX is only for punctuation.

### 5. Library page (`/library`) — declarative + one outcome
- Nav pill + tab switches → `data-cuelume-toggle="toggle"`.
- Bento/list card **hover** → `data-cuelume-hover="chime"` (fine-pointer only).
- Play in Cinema Feed → `data-cuelume-press="press"`.
- Bulk **download ZIP complete** → `play("success")` at the end of the existing `client-zip` promise.
- Delete confirmed → `play("droplet")`.

### 6. Accessibility & UX guards
- Cuelume's built-in guarantees (fine-pointer gating, hover throttle, autoplay resume, silent no-op on failure) handle 90% of the etiquette.
- Add our own: respect `prefers-reduced-motion` for default-off, and expose the toggle from BubbleMenu so users can flip it any time. Sound state is client-only — never blocks the app.

### 7. Files touched
- **new** `src/lib/sfx.ts`
- **edit** `src/routes/__root.tsx` (init on mount)
- **edit** `src/components/reactbits/BubbleMenu.tsx` (+CSS) — add mute toggle
- **edit** `src/components/zap/LandingHero.tsx`, `ChooseReality.tsx`, `ModesSection.tsx` — declarative attributes
- **edit** `src/components/reactbits/InfiniteMenu.tsx` — one imperative `play("sparkle")` on snap
- **edit** `src/routes/index.tsx` — imperative calls at the ~14 state-change sites above
- **edit** `src/components/zap/stage/DesktopStage.tsx` + `MobileStage.tsx` — attach camera-flip / depth-toggle sounds where handlers live
- **edit** `src/routes/library.tsx` — declarative attributes + ZIP/delete sounds
- **package.json** — `cuelume` dependency

No schema, RLS, or server changes. Zero effect on the Lucy pipeline latency budget.

### Verification
- Load `/`, hover the CTA and menu — bloom + tick audible; sweep the menu quickly and confirm the 150 ms throttle keeps it calm.
- Toggle the new speaker in BubbleMenu — subsequent interactions silent; localStorage key `zap.sfx=false` persists across reload.
- Start a session: expect `ready` on first frame, `tick` on prompt apply, `toggle` on a thumbs-up gesture, `sparkle` on a "Computah" wake, `ready` when the take is downloadable, `droplet` on disconnect.
- `/library`: hover cards, download a bulk ZIP → `success` on completion.
- `tsgo --noEmit` clean, no bundle regressions (cuelume is <5 kB gzip).

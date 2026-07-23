# /discover HappyOyster field redesign — presentation-only plan

Restyle `/discover` to match the HappyOyster world-field screenshots across a single implementation pass covering all 5 sub-prompts (tokens+dock+scatter, dithered clouds+blobs, flying/pan, onboarding overlay). Engine files are untouched; new UI lives under `src/components/happy-oyster/field/` and is wired into `src/routes/discover.tsx` inside the existing `showApp` gate.

## Hard invariants (do not touch)
- `src/components/happy-oyster/ho-client.tsx`
- `src/components/happy-oyster/use-world-session.ts`
- `src/lib/happy-oyster/*` (worlds, view, featured-worlds, world-pins, reactor-setup.functions)
- `src/routes/api.reactor.token.ts`
- `src/routes/discover.tsx` keeps `ssr: false`, `React.lazy`, loader, head, and the `showApp ? <App /> : <SetupRequired />` gate structure
- Existing `Sidebar`, `Screen`, `Gallery`, `Composer`, `AdventureControls`, `DirectingControls`, `HappyOysterApp` files remain untouched
- No visual change outside `/discover`

## New files (all under `src/components/happy-oyster/field/`)
```text
field/
  tokens.ts              design tokens (paper, ink, gold ref, pills, shadows, type)
  FieldRoot.tsx          top-level fixed inset-0 shell + provides pan context
  FieldStage.tsx         positions the world-plane (clouds + blobs) with pan transform
  CloudCanvas.tsx        static <canvas>: value-noise gray blobs + 4x4 Bayer dither
  WorldBlob.tsx          image masked by irregular blob path + dithered rim
  DecorativeBlob.tsx     smaller reused blobs (same click target as a featured world)
  CreateBlob.tsx         dark "+ CREATE YOUR OWN" blob in the field
  BottomDock.tsx         "+ CREATE A WORLD", "?", sound-toggle (placeholder)
  HoverChip.tsx          mono-caps title chip shown under a hovered blob
  OnboardingOverlay.tsx  3-step black organic blob card w/ dithered rim
  usePanController.ts    RAF pan (edge-hover, drag, arrow keys) + rubber-band clamp
  useBlobShape.ts        seeded radial-spline generator (SVG path + point list)
  dither.ts              Bayer 4x4 threshold + ring-dither helpers (shared)
  types.ts               shared types (Vec2, Bounds, WorldPlacement, etc.)
```

## Design tokens (`tokens.ts`)
```ts
export const HO = {
  paper: "#ECE5D3",
  ink: "#0D0C0A",
  creamPill: "#F1EAD5",
  darkPill: "#1C1B18",
  cloud: "#8A8C8B",
  cloudDark: "#5C6063",
  gold: "var(--reactor-color-light-gold)",
  mono: `"IBM Plex Mono", ui-monospace, monospace`,
  display: `"Inter", system-ui, sans-serif`, // heavy geometric fallback at 700–800
  pillGlow: "0 0 24px rgba(241,234,213,.35)",
  goldGlow: "0 0 28px color-mix(in oklab, var(--reactor-color-light-gold) 55%, transparent)",
};
```
All new UI reads from here; no hardcoded hex elsewhere.

## `discover.tsx` wiring (minimal)
Inside `DiscoverPage`, replace the current `<HappyOysterApp />` render with `<FieldRoot />` (still lazy, still `ssr:false`). `<SetupRequired />` branch stays exactly as is. `FieldRoot` mounts `HappyOysterApp` invisibly for the engine (or, cleaner: `FieldRoot` uses the same `LiveClientProvider` + `useWorldSession` engine hooks that `HappyOysterApp` uses today) — but per the "engine untouched, wire later" rule, this pass keeps world-clicks as no-ops and does not import the session hook yet. Only `getReactorSetup` loader stays.

## Field layout (Prompt 1)
- `FieldRoot`: `fixed inset-0 overflow-hidden` with `bg-[--ho-paper]`.
- `FieldStage`: virtual field sized `2.5×` viewport width × `1.8×` height, transformed via `translate3d(x,y,0)` from `usePanController`.
- `CloudCanvas`: absolute-fills the stage, rendered once on mount + on resize.
- 6 `WorldBlob`s (from `FEATURED_WORLDS`) scattered with seeded, non-overlapping positions; sizes 180–420px.
- 4–6 `DecorativeBlob`s reusing the same 6 images at lower prominence.
- 1 `CreateBlob` positioned in a visually strong slot.
- `BottomDock`: `fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-40` — dark pill "+ CREATE A WORLD", round "?" (opens onboarding step 1), round sound-toggle (mute icon, no-op).

## Cloud/dither rendering (Prompt 2, `CloudCanvas` + `dither.ts`)
1. Draw ~14 low-frequency value-noise gray blobs (`cloud`/`cloudDark`) with soft radial gradients across an offscreen canvas at 1/4 resolution.
2. Read pixel data; for every 4×4 screen-pixel cell apply a 4×4 Bayer threshold against luminance → output either `cloudDark` or `paper` (1-bit ordered dither). Chunky pixel size 4–5px.
3. Blit result onto the visible canvas. Redraw only on resize; export the source noise seed so a slow drift is possible later without refactor.

## World blobs (Prompt 2, `WorldBlob` + `useBlobShape`)
- `useBlobShape(seed, radius)` returns an SVG path from 8–10 radial control points with per-seed jitter (±22% radius) smoothed via Catmull-Rom → cubic Bézier.
- Blob renders an `<svg>` with:
  - `<clipPath>` from the path; the world image (`<image href={world.image}>`) is clipped inside it.
  - A stroke pass that samples the path outline and draws a ~10px dithered ring (Bayer 4×4, dark pixels only) via a small `<canvas>` sibling positioned over the rim.
- Hover: `scale(1.04)`, `boxShadow: HO.goldGlow`, cursor pointer, `HoverChip` fades in under the blob showing world name in mono caps.

## Flying interaction (Prompt 3, `usePanController`)
- RAF loop maintains `pos`, `vel` vectors.
- Desktop: mouse within 120px of any edge → target velocity ramps ease-in up to ~14 px/frame diagonal.
- Touch: `pointerdown`/`move`/`up` (pointer-type touch) → drag pans the field 1:1; velocity carries momentum on release.
- Keyboard: arrow keys add impulse; Tab cycles focus through world blobs with gold focus ring (`outline: none; box-shadow: goldGlow`).
- Rubber-band: soft clamp with `pos = clamp + (over × 0.35)`, snap-back when input stops.
- Parallax: `CloudCanvas` receives `translate3d(x*0.85, y*0.85, 0)` while blob layer uses `1.0`.
- No page scroll: `<html>` overflow untouched globally; `FieldRoot` uses `touch-action: none` and `overscroll-behavior: contain`.

## Onboarding overlay (Prompt 4, `OnboardingOverlay`)
- Same black organic blob shape from `useBlobShape` (larger seed, ~720px wide), with matching dithered rim via `dither.ts`. No backdrop blur — field visible around it.
- X close button (top-right, inside blob, mono).
- Step 1: wordmark "HAPPY" (white) + "OYSTER" (gold), heavy sans, tight tracking; copy: *"Alibaba's latest world model. Explorable worlds and interactive videos you can direct as they play, generated in real time on Reactor."*; cream pill "NEXT →".
- Step 2 (new copy in the same voice): *"Two ways in. ADVENTURE worlds you walk with WASD. DIRECTING worlds you steer with text as they play."*; cream pill "NEXT →".
- Step 3: *"Step into any world around you, or create your own."* + smaller *"Move your mouse to the edges to fly across the field."*; two buttons — outline dark pill "CREATE YOUR OWN" (closes; will open composer once that exists — no-op for now) and cream pill "EXPLORE WORLDS →" (closes).
- Step indicator: three short dashes bottom-center; active one wider + brighter gold.
- Shown on first visit only via `localStorage["ho-onboarded"]`; "?" in dock reopens at step 1.

## Accessibility & perf
- All buttons are real `<button>` elements with mono-caps labels; focus ring uses gold glow.
- World blobs get `role="button"`, `aria-label={world.title}`, `tabIndex={0}`.
- Canvas draws once + on resize (throttled).
- Blob SVGs are memoized on `(seed, radius)`.

## Out of scope for this pass (explicit)
- Wiring world clicks to `useWorldSession` / `run(intent)` (later prompt).
- Composer sheet, Screen playback, Sidebar controls (files remain untouched).
- Sound toggle audio.
- Cloud drift animation.

## Verification
- `bun run build` passes.
- `/discover` renders the field with dock + onboarding on first load; `SetupRequired` branch unchanged when key missing.
- No visual change on `/`, `/library`, `/remote/$sessionId`.
- Screenshot `/discover` at 1280×800 and compare against the reference: chunky visible dither pixels, paper visible between clouds, blob rims biting into clouds, dock centered, onboarding blob organic + dithered.

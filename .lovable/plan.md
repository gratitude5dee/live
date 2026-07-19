## Goal
Replace the current one-size Stage (`src/routes/index.tsx`) with two purpose-built layouts: a **Desktop Cockpit** and a **Mobile Capture** view, sharing state + logic but rendering different shells.

## Architecture

```text
src/routes/index.tsx                → orchestrates session state, chooses shell
src/hooks/useIsMobile.ts            → matchMedia (max-width: 767px) + touch check
src/components/zap/stage/
  ├─ StageProvider.tsx              → context: session, transport, refs, actions
  ├─ DesktopStage.tsx               → 3-zone cockpit
  ├─ MobileStage.tsx                → full-bleed capture
  ├─ shared/
  │   ├─ PresetTile.tsx             → thumbnail + badge, reused both views
  │   ├─ PromptDock.tsx             → input + send + shortcuts
  │   ├─ HudPiP.tsx                 → landmarks overlay canvas
  │   ├─ CountdownPill.tsx          → 90s timer chip
  │   ├─ QrPanel.tsx                → remote link QR
  │   └─ DownloadTakeButton.tsx     → post-session CTA
```

All session logic (fal transport, MediaPipe, recording, countdown, upload) moves into `StageProvider` unchanged in behavior — pure lift, no logic rewrite.

## Desktop Cockpit (≥768px)

```text
┌──────────────────────────────────────────────────────────────┐
│  [WZRD BubbleMenu]                        [Countdown][Disc.] │
├────────────┬─────────────────────────────┬───────────────────┤
│            │                             │  HUD PANEL        │
│  PRESET    │                             │  ┌─────────────┐  │
│  RAIL      │      9:16 LIVE OUTPUT       │  │   PiP feed  │  │
│  (scroll)  │      (centered, max h)      │  │   landmarks │  │
│            │                             │  └─────────────┘  │
│  ├ preset  │      double-bezel frame     │  ┌─────────────┐  │
│  ├ preset  │                             │  │   QR remote │  │
│  ├ tmpl 📥 │                             │  └─────────────┘  │
│  ├ …       │                             │  gesture ticker   │
│            │                             │  fps / status     │
├────────────┴─────────────────────────────┴───────────────────┤
│  ⌨ PROMPT DOCK  [ input… ]  [ send ]  ⌘Z undo  ⇧⌘R record  │
└──────────────────────────────────────────────────────────────┘
```

- Left rail: vertical scroll list of presets + templates with thumbnails, hover shimmer (PixelCard-lite).
- Center: 9:16 video in a Double-Bezel frame, PiP and QR removed from over the video.
- Right HUD panel: PiP, QR, gesture/face event ticker, connection FPS, take countdown.
- Bottom prompt dock: full-width glass bar, SpecularButton send, keyboard hint row.

## Mobile Capture (<768px)

```text
┌──────────────────────┐
│  ▪ WZRD    ⏱ 1:23 ⨯ │  ← floating chips on video
│                      │
│                      │
│                      │
│   FULL-BLEED 9:16    │
│   LIVE OUTPUT        │
│                      │
│      ┌────┐          │
│      │PiP │ ← tap to hide
│      └────┘          │
│                      │
│                      │
├──────────────────────┤
│ ← preset preset · · →│  ← horizontal snap rail
├──────────────────────┤
│ [prompt…]      [Send]│  ← sticky glass dock
└──────────────────────┘
```

- Full-bleed video (respects safe-area insets).
- Floating minimal HUD chips: countdown, disconnect, flip-camera.
- PiP as a small draggable/tappable thumbnail in a corner.
- Horizontal preset rail with scroll-snap.
- Sticky bottom prompt dock above keyboard.
- Flip-camera button (front/back) using `getUserMedia({ facingMode })`.
- QR moves into a `⋯` sheet (not needed on the phone itself).

## Shared design tokens (added to `src/styles.css`)

```css
--stage-bg: oklch(0.09 0.02 260);
--surface-1: oklch(0.14 0.02 260 / 0.6);
--surface-2: oklch(0.18 0.03 260 / 0.7);
--hairline: oklch(1 0 0 / 0.08);
--stage-radius-outer: 2rem;
--stage-radius-inner: calc(2rem - 0.375rem);
--ease-cockpit: cubic-bezier(0.32, 0.72, 0, 1);
```

## Implementation steps

1. Add `useIsMobile` hook + tokens.
2. Extract all session logic from `src/routes/index.tsx` into `StageProvider` (no behavior change; verify via existing flow).
3. Build shared subcomponents (`PresetTile`, `PromptDock`, `HudPiP`, `CountdownPill`, `QrPanel`, `DownloadTakeButton`).
4. Build `DesktopStage` (3-zone grid, double-bezel video frame, right HUD panel).
5. Build `MobileStage` (full-bleed video, floating chips, horizontal rail, sticky dock, flip camera).
6. `src/routes/index.tsx` becomes: landing gate → `StageProvider` → `isMobile ? MobileStage : DesktopStage`.
7. Verify: typecheck, load on desktop viewport (1280) and mobile viewport (390), confirm live session, recording, download, presets, template drop, disconnect all still work in both shells.

## Non-goals (unchanged)

- No changes to fal transport, MediaPipe engines, Supabase schema, presets/templates data, landing hero, ChooseReality, Modes, Footer.
- No new features beyond the mobile **flip camera** control.

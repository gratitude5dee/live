# /discover engine wiring + composer overlay + QA pass

Presentation-only work over three sub-prompts. The engine surface (`useWorldSession`, `useHappyOysterClient`, `LiveClientProvider`, `useVideoSlot`, `AdventureControls`, `DirectingControls`, `deriveView`, `deriveJourney`, `TRAVEL_SECONDS`) is called exactly as `HappyOysterApp` + `Sidebar` + `Screen` call it today. No edits to those files, and no edits to `ho-client.tsx`, `use-world-session.ts`, `AdventureControls`, `DirectingControls`, `Composer`, `Sidebar`, `Gallery`, `Screen`, `StatusBadge`, `ui.tsx`, `HappyOysterApp.tsx`, or anything under `src/lib/happy-oyster/*`.

## Hard invariants
- Engine files above stay byte-identical. New UI imports from them read-only.
- `src/routes/discover.tsx` keeps `ssr:false`, `React.lazy`, loader, head, `showApp` gate.
- Nothing outside `/discover` changes visually.
- Old `Sidebar`, `Screen`, `Gallery`, `Composer`, `HappyOysterApp` files stay on disk unmodified but are no longer rendered on `/discover`.

## New files under `src/components/happy-oyster/field/`
```text
FieldApp.tsx           new top of the tree: owns intent+mode, mounts
                       LiveClientProvider keyed on mode, renders <FieldRoot session=…>
FieldRoot.tsx          MODIFIED — accept session prop; render focus/session overlays
FocusBlob.tsx          expanded centered blob for hover-selected world (title + mode chip + ENTER WORLD)
SessionStage.tsx       overlay driven by session.view: connecting/building/traveling/ready/error
JourneyBlob.tsx        black blob with the 4-step journey (session.journey), first_frame dimmed inside once available
TravelStage.tsx        fullscreen videoSlot + corner HUDs + bottom control-deck panel
EndBlob.tsx            "TRAVEL ENDED" blob with WorldIdChip, TRAVEL AGAIN / BACK TO WORLDS
ErrorBlob.tsx          red-tinted blob with message, TRY AGAIN / BACK TO WORLDS
StatusChip.tsx         tiny top-left mono chip (dot + DISCONNECTED/CONNECTING/CONNECTED), click connects/disconnects
Composer.tsx           blob-card composer: prompt + first-frame + mode toggle + knobs + BUILD WORLD; toggles to attach form
useTravelTimer.ts      countdown extracted 1:1 from Sidebar (60s / 180s via TRAVEL_SECONDS)
pill.tsx               shared CreamPill / DarkPill / OutlinePill / MonoChip primitives (extracted from OnboardingOverlay)
```

## Owning intent + mode (`FieldApp.tsx`)
Mirrors `HappyOysterApp` exactly — the pattern is required so mode-change remounts the provider:
```tsx
const [mode, setMode] = useState<HappyOysterMode>("adventure");
const [intent, setIntent] = useState<WorldIntent | null>(null);
const run = (i: WorldIntent) => { setMode(i.mode); setIntent(i); };
const clearIntent = () => setIntent(null);
return (
  <LiveClientProvider mode={mode} key={mode}>
    <FieldRootBridge intent={intent} onRun={run} onClearIntent={clearIntent} />
  </LiveClientProvider>
);
```
`FieldRootBridge` calls `useWorldSession({ intent, onRun: run, onClearIntent })` and passes the session down. `discover.tsx` lazy-imports `FieldApp` instead of `FieldRoot`.

## FieldRoot changes
- Take `session: WorldSession` prop.
- Blob click no longer no-op: sets local `focused` world state (does not call `run`).
- Renders on top of the existing field: `<StatusChip />` (top-left), `<FocusBlob />` when `focused && view.kind === "browse"`, `<SessionStage session />` when `view.kind !== "browse"`, `<Composer />` sheet when `composerOpen`.
- Bottom dock: "+ CREATE A WORLD" and "?" wire to `setComposerOpen(true)` and `setOnboarding(true)`. `CreateBlob` in the field opens composer too.
- Onboarding "CREATE YOUR OWN" → closes overlay, opens composer.
- Pan is disabled while any overlay is open (`focused || view !== browse || composerOpen || onboarding`).

## Focus state (`FocusBlob.tsx`) — Prompt 5.1
Centered fixed overlay over a light paper scrim (no backdrop-blur), field visible around it. ~560px organic blob (reuses `useBlobShape`) with the world image clipped inside and the dithered rim, plus:
- Above the blob: world title in white heavy sans, `letter-spacing: -0.01em`, ~44px.
- Under the title, tiny dark mono chip: "ADVENTURE" or "DIRECTING".
- Below the blob: `CreamPill` "ENTER WORLD →" → calls `session.run(intentFor(world))`.
- Close: X in corner, click outside, or `Esc` → `setFocused(null)`.

`intentFor(world)` mirrors the current `Gallery`:
```ts
world.encryptedWorldId
  ? { kind: "attach", mode: modeName(world.mode), encryptedWorldId: world.encryptedWorldId, title: world.title }
  : { kind: "create", mode: modeName(world.mode), params: { prompt: world.prompt }, title: world.title }
```

## Session overlays (`SessionStage.tsx`) — Prompt 5.2
Switches on `session.view.kind`:
- `connecting` / `building`: `<JourneyBlob />` — centered black blob, ~560px, renders `session.journey` rows in mono caps with existing done/active/pending logic. When `session.seedFrame` present, `<img>` inside blob at `opacity: 0.35` behind the step list.
- `traveling`: `<TravelStage />` fullscreen — mounts `useVideoSlot()` at `position:fixed inset-0 z-40`. HUD:
  - top-left: world title + mode chip (`MonoChip`).
  - top-right: countdown (`useTravelTimer(live, TRAVEL_SECONDS[mode], client.endTravelSession)` — extracted 1:1 from Sidebar) + `DarkPill` "END TRAVEL" (`client.endTravelSession`).
  - bottom-center: a wrapping panel `bg-black/55 backdrop-blur-xl rounded-2xl border border-white/10 p-4 max-w-[720px]` that renders the **unmodified** `<AdventureControls />` or `<DirectingControls />` based on `worldState?.mode`. The wrapper is presentation-only; internal styling stays untouched.
- `ready`: `<EndBlob />` — organic blob, "TRAVEL ENDED" mono caps eyebrow, world title, `WorldIdChip` (reused from `ui.tsx`), `CreamPill` "TRAVEL AGAIN" (`session.beginTravel`), `DarkPill` "BACK TO WORLDS" (`session.exit`).
- `error`: `<ErrorBlob />` — same organic blob with `filter: hue-rotate(0) tint red`, message text, `CreamPill` "TRY AGAIN" (`session.retry`), `DarkPill` "BACK TO WORLDS" (`session.exit`).

## StatusChip (`StatusChip.tsx`) — Prompt 5.3
Top-left, `position:fixed top-4 left-4 z-40`. Dark pill, 24px tall, mono 10px. Colored dot + label from `client.phase`:
- `idle`/`ended` → gray dot, `DISCONNECTED`
- `connecting` → amber dot pulsing, `CONNECTING`
- `connected`/`starting_stream`/`streaming` → gold dot, `CONNECTED`
- `failed` → red dot, `CONNECTION FAILED`

Click behavior copies `StatusBadge`: when idle → `client.connect()`, otherwise → `client.disconnect()` (or `session.exit` if there's an intent, matching current `Sidebar`).

Shown only when `view.kind === "browse"` and no focus/composer overlay is open (avoids stacking against session HUDs, which have their own top-left title).

## Composer overlay (`Composer.tsx`) — Prompt 6
Blob-card composer (organic ink blob, same shape family as onboarding, ~700px wide, dithered rim, no backdrop-blur). Contents:
- Segmented toggle at top: `ADVENTURE` / `DIRECTING`, dark pills; active pill uses gold fill.
- Textarea: mono, dark field `bg-black/40`, `color: #F1EAD5`, placeholder in cream/30, `rows=5`, `maxLength=2000`. Same "prompt.trim() required" gate.
- First-frame image chip (mono caps "OPTIONAL FIRST FRAME"): file input `accept="image/*"`; enforces `MAX_FIRST_FRAME_IMAGE_BYTES` from `@reactor-models/happy-oyster`; shows filename + Remove on select; renders `imageError` in red mono.
- Mode-specific knobs (same values, same "omit when auto" behavior as `CustomCompose`):
  - Adventure: Perspective — `third_person` / `first_person`.
  - Directing: Resolution `720p`/`480p`; Camera motion `auto`/`Stable`/`Fast` (omit when auto); Narrative `auto`/`Normal`/`Calm`/`Dramatic` (omit when auto).
- `CreamPill` "BUILD WORLD →" dispatches identical payload to `CustomCompose.build()`, then calls `session.run(intent)` and closes the composer.
- Small mono link "HAVE A WORLD ID?" bottom-left flips to attach view: id text input + Adventure/Directing toggle + `CreamPill` "ATTACH →" with payload identical to `AttachById.onIntent(...)`.
- Close: X (top-right of blob) or `Esc` → `onClose()`. Field stays live behind.

The payload construction is copy-of-`CustomCompose` and copy-of-`AttachById`, not import — those components are React JSX with different styles; we can't reuse them structurally. Payload shapes match byte-for-byte.

## `discover.tsx` change
Only line changed: swap `FieldRoot` lazy import for `FieldApp`. `<SetupRequired />` branch unchanged.

## Prompt 7 — visual + functional QA pass
After building the above, screenshot `/discover` at 1280×800 and each state via Playwright, compare against the reference screenshots, and land only presentation fixes:
- Cloud/blob rims still show chunky ordered dither (no smooth blur).
- Blob shapes stay organic and unique (verify `useBlobShape` seeds diverge).
- Pill hierarchy: cream = primary action, dark = secondary, gold = accent only. Enforce by grepping the field/* files for any accidental hardcoded gold-on-button.
- Onboarding: solid black organic blob, dithered rim, dash indicator (already built).
- Focus state layout matches the "Big Surf" screenshot: title above, mode chip under title, `ENTER WORLD →` centered under blob.
- Bottom dock centered: `+ CREATE A WORLD` / `?` / sound.
- Functional regression via Playwright script (`/tmp/browser/ho/session.py`):
  1. Load `/discover`, dismiss onboarding, click a featured world → focus blob shows correct title + mode.
  2. Click ENTER WORLD → journey blob visible, steps advance; screenshot after ~3s and after streaming.
  3. Traveling: video slot fills viewport, HUD chips visible, countdown ticks down.
  4. End travel → EndBlob shows world id chip.
  5. Reload, open composer, submit a create with a short prompt → dispatch reaches journey stage.
  6. Composer → attach form, paste dummy id → button enabled; do not submit (avoids a real attach).
  7. Nav to `/`, `/library`, `/remote/x` and screenshot — assert no visual diff beyond existing.

Everything gated on the same `hasKey` loader; when the key is missing the whole thing still returns `SetupRequired`, unchanged.

## Explicitly out of scope
- Modifying any engine file.
- Cloud drift animation.
- Sound-toggle audio.
- Any change to `/`, `/library`, `/remote/$sessionId`, `__root.tsx`.

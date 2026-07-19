## Goal

Rename the four character-swap presets to their real names, tag Fire Hands as a new hand-driven category, and route MediaPipe baking based on the preset's category so Lucy gets the right signal (face for identity swaps, hands for hand VFX, clean webcam for everything else).

## 1. Data changes (via `supabase--insert`)

Update the seeded rows in `public.presets` (user_id IS NULL):

- id 11 "Hooded Windbreaker" → name "YE", emoji 🕶️
- id 13 "Leather Vest" → name "DRAKE", emoji 🎤
- id 15 "Streamer" → name "N3ON", emoji 💻
- id 16 "Pink Stripe Kit" → name "MBAPPE", emoji ⚽
- id 6 "Fire Hands" → set `template_key = 'gesture_fx'` (keep name/emoji/prompt)

No schema migration needed — `template_key` is already a free-form text column, so "gesture_fx" is a valid new value alongside the existing "character_swap", "object_add", "clothing_tryon", "object_replace".

## 2. Compositor gating — `src/routes/index.tsx`

Widen the ref that tracks the active category and drive both overlays from it:

```ts
const activePresetKindRef = useRef<"character_swap" | "gesture_fx" | "other">("other");
```

- On `stopSession` / preset clear → `"other"`.
- On `applyPreset(preset)` →
  - `character_swap` if `preset.template_key === "character_swap"`
  - `gesture_fx` if `preset.template_key === "gesture_fx"`
  - else `"other"`.
- In the `CompositeStream` draw loop:
  - Bake face landmarks only when `activePresetKindRef.current === "character_swap"` (current behavior, unchanged).
  - Bake hand landmarks only when `activePresetKindRef.current === "gesture_fx"` (new — currently hands are never baked into the outbound stream).
  - Otherwise draw the raw video frame only.
- PiP overlay for the user keeps showing both face + hands regardless (feedback only).

## 3. Preset rail categorization — `src/components/zap/stage/DesktopStage.tsx` and `MobileStage.tsx`

Group the rail by category derived from `template_key`:

- **Templates**: `object_add`, `clothing_tryon`, `object_replace`
- **Character Swap**: `character_swap` (YE, DRAKE, N3ON, MBAPPE)
- **Gesture FX**: `gesture_fx` (Fire Hands)
- **Looks**: everything else (Beach, Neon City, Anime, …)

Each group renders as a small section header (using existing `ShinyText`) followed by the existing single-line preset rows. No new components — just partition the array before render.

## 4. Out of scope

- No changes to `composite-stream.ts` internals, aspect ratio, or resolution.
- No changes to the prompts themselves (only names/emojis for the four swaps).
- No new template dialogs — YE/DRAKE/N3ON/MBAPPE remain non-template presets that apply the seeded prompt + baked-in reference image on click.

## Result

Clicking YE / DRAKE / N3ON / MBAPPE sends the face-landmark-baked stream to Lucy (better identity lock). Clicking Fire Hands sends the hand-landmark-baked stream (crisper effect anchoring). Everything else sends the clean 1080×1920 webcam frame.

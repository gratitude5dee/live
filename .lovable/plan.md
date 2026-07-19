
## 1. Cleaner outbound stream to Lucy

The composite currently bakes hand landmarks (always) and face landmarks (character-swap only) into the 720×1280 canvas sent to Lucy. That's why the output looks noisy/blurry.

- `src/lib/zap/composite-stream.ts` — bump target to 1080×1920 (Lucy still downsamples but we hand it a crisper source), keep 30fps.
- `src/routes/index.tsx` — stop baking hand landmarks into the outbound stream. The compositor's `draw` callback becomes a no-op unless the active preset is `character_swap` (then draw face mesh only). Hand/face overlays continue to render into the PiP overlay canvas for user feedback — nothing changes visually in the Camera card.

Net effect: Lucy receives a clean, center-cropped 9:16 video with no baked overlays for normal presets, only a face mesh when re-identification actually needs it.

## 2. Redesign the left preset rail

Current rows visibly clip the preset name (top half cut off) and the subtitle bleeds into the next row.

- `src/components/zap/stage/DesktopStage.tsx` `PresetRow`:
  - Give each row a defined min-height, `items-center`, and remove the two-line stacked label — one line, `truncate`, with a small right-aligned badge for shortcut / "drop image".
  - Slightly smaller thumbnail (h-10 w-10), consistent padding, tighter `gap-2` list spacing.
  - Add a section separator between "Templates" (kind === 'template') and standard presets so the dashed template rows read as their own group.
  - Rail width 260 → 240px; keep scroll but ensure last row isn't clipped by parent (add `pb-2` inside scroll region).

Purely presentational — no store or data changes.

## 3. New "Object Replace" template preset

Follows the same drop-image + auto-prompt pattern as Object add-in / Try-on.

- `src/lib/zap/prompt-templates.ts`:
  - Add `object_replace` to `TemplateKey`.
  - `buildTemplatePrompt('object_replace', { detail, placement })` returns a Lucy "Add/Replace" prompt: replaces the object the person is holding (or the target region) with the reference image, matching size/lighting, identity+background unchanged.
  - Add matching `TEMPLATE_META` entry (placement label: "What to replace", placeholder: "e.g. the phone in the person's hand"; detail placeholder: "e.g. the plush green backpack from the reference image").
- DB migration (single statement, additive): insert one row into `presets` with `kind='template'`, `template_key='object_replace'`, name "Object replace", emoji 🔄, `requires_ref=false` (image comes from the dialog, not the ref slot).
- `TemplateDialog.tsx` — no changes required; it already renders any key present in `TEMPLATE_META` and uploads the dropped image via the existing `onApply` path in `src/routes/index.tsx`.

## Out of scope

- No changes to fal transport, MediaPipe engines, or PiP overlay rendering.
- No mobile stage changes (all three fixes are desktop-visible; template preset appears on mobile automatically via shared preset list).

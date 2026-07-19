# Drop-image template presets

Add a new class of presets called **templates**: the user drops a reference image (+ optional short hint) and Zap auto-writes a structured Lucy 2.5 prompt following the docs' Add / Replace patterns, then applies it to the live feed with the dropped image as the reference.

Ship two templates first, with room to add more:
1. **Object add-in** — drop an object/prop image → "Add \<object description\> to \<placement\>, \<physical interaction cues\>."
2. **Clothing try-on** — drop a garment image → "Replace the person's \<garment slot\> with \<garment description from reference\>. Keep the person's identity, face, and hair unchanged."

## UX

In the existing preset rail (`src/routes/index.tsx` around line 1195), templates render as distinct tiles (dashed border, 📥 badge) alongside the existing image presets. Clicking a template opens a small popover/modal with:
- a drop zone / file picker (also accepts paste)
- one short optional field: *placement* (Object add-in) or *garment slot* (Try-on, default "top / jacket")
- an optional *detail hint* input (e.g. "glossy leather, silver zipper")
- an **Apply** button

On Apply:
- upload the image to the existing `refs` storage bucket (reuse the `savePreset` upload path), get a signed/public URL
- build the structured prompt from the template + user inputs (see Technical section)
- call `applyPrompt(text, "preset", { dataUri, path })` so the same reference image is sent to Lucy via `reference_image_url` and logged in `prompt_events`
- close the modal, toast "Applied — \<template name\>"

Drag-and-drop onto the whole stage while a template is "armed" is a nice-to-have; v1 uses the modal only.

## Data

Extend the `presets` row shape with a `kind` column (`'preset' | 'template'`, default `'preset'`) and a `template_key` column (`'object_add' | 'clothing_tryon'`). Seed two rows via migration:

```
kind='template', template_key='object_add',      name='Object add-in',   emoji='📦', requires_ref=true
kind='template', template_key='clothing_tryon',  name='Try-on',          emoji='👕', requires_ref=true
```

Existing presets keep `kind='preset'` and render unchanged. `Preset` type in `src/lib/zap/types.ts` gains the two optional fields.

## Prompt expansion (client-side, deterministic)

New helper `src/lib/zap/prompt-templates.ts` exports:

```ts
buildTemplatePrompt(
  key: 'object_add' | 'clothing_tryon',
  opts: { detail?: string; placement?: string; slot?: string }
): string
```

Following the Lucy prompting guide:

- **object_add** →
  `Add ${detail ?? 'the object from the reference image'} to ${placement ?? "the person's hand"}, attached naturally and shifting with their motion. Cast soft light on nearby skin and clothing so it feels physically present. Keep the person's identity, face, hair, and background unchanged.`

- **clothing_tryon** →
  `Replace the person's ${slot ?? 'top'} with ${detail ?? 'the garment from the reference image'}, matching its color, material, texture, fit, and any logos or trims. The garment moves with the body. Keep the person's identity, face, hair, pose, and background unchanged.`

Lucy's own `enable_prompt_expansion` (already wired via the `enhance` toggle) further polishes the sentence server-side — we keep it on.

## Files touched

- `supabase migration` — add columns + seed two template rows + grants unchanged
- `src/lib/zap/types.ts` — extend `Preset`
- `src/lib/zap/prompt-templates.ts` — new
- `src/components/zap/TemplateDialog.tsx` — new (drop zone + inputs + Apply)
- `src/routes/index.tsx` — render template tiles, open dialog, handle apply (reuse `applyPrompt` + existing upload code from `savePreset`)

Nothing else changes: the transport, recording, gestures, and existing image presets are untouched.

## Out of scope (v1)

- Additional templates (background swap, restyle, remove) — trivial to add later by extending `template_key` + the switch in `buildTemplatePrompt`.
- Persisting the user's dropped image as a saved preset (already covered by the existing `＋ Save` button).

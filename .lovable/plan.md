## Add image + prompt presets

Upload the 6 uploaded reference images as Lovable Assets, extend the `presets` table with a thumbnail/reference URL, seed the new presets, and render the thumbnails in the preset rail. Clicking a character-swap preset auto-loads its reference image as the active reference so Lucy gets the identity to match.

### 1. Upload images as Lovable Assets
Run `lovable-assets create` for each of the 6 uploaded files into `src/assets/presets/`:
- `kanye.webp` → Man in black hooded windbreaker
- `metlife2.jpg` → NFL stadium at night
- `drake.webp` → Performer in leather vest
- `metlife-stadium-photo.webp` → Soccer stadium daylight
- `neon.webp` → Streamer on green background
- `mbappe.webp` → Player in black-and-pink kit
- `messi.webp` → bonus (skip unless needed — not in the request list)

### 2. Migration: extend `presets`
```sql
alter table public.presets
  add column if not exists thumbnail_url text,
  add column if not exists ref_image_url text;

insert into public.presets (user_id, name, emoji, prompt, requires_ref, sort_order, thumbnail_url, ref_image_url) values
  (null, 'Hooded Windbreaker', '🧥', '<prompt 1>', true, 200, '<kanye url>', '<kanye url>'),
  (null, 'NFL Night',           '🏟️', '<prompt 2>', false, 210, '<metlife2 url>', null),
  (null, 'Leather Vest',        '🎤', '<prompt 3>', true, 220, '<drake url>', '<drake url>'),
  (null, 'Soccer Daylight',     '⚽',  '<prompt 4>', false, 230, '<metlife url>', null),
  (null, 'Streamer',            '💻', '<prompt 5>', true, 240, '<neon url>', '<neon url>'),
  (null, 'Pink Stripe Kit',     '🌸', '<prompt 6>', true, 250, '<mbappe url>', '<mbappe url>');
```
Regenerate `src/integrations/supabase/types.ts` (add the two nullable string columns).

### 3. UI updates in `src/routes/index.tsx`
- **Preset button:** if `p.thumbnail_url`, render a small rounded thumbnail (with the emoji as a corner badge) instead of the emoji-only tile. Keep name as tooltip/label.
- **applyPreset:** when `preset.ref_image_url` is set, fetch it → data URI, `setRefImage({ dataUri, path: preset.ref_image_url })`, then call `applyPrompt(preset.prompt, source, {dataUri, path})`. This satisfies `requires_ref` without the user uploading anything.
- Cache converted data URIs in a ref map so re-clicking is instant.

### 4. No other file changes needed
`Preset` type auto-updates from regenerated Supabase types. Remote/gesture flows continue to work since they call `applyPreset`.

### Technical notes
- Prompts are the exact strings from the user's message.
- `ref_image_url` doubles as the thumbnail source and the reference sent to Lucy for character-swap presets. Scene presets (stadiums) have `ref_image_url = null` and `requires_ref = false`.
- The layered combo isn't a stored preset — it can be reproduced by clicking the NFL Night scene then the Hooded Windbreaker character preset in sequence (each apply stacks over the current state).

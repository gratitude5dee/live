# Fix: preset reference images fail when clicked

## What's wrong

The character-swap presets (YE, DRAKE, N3ON, MBAPPE) store their reference image as a
site-relative path, e.g. `/__l5e/assets-v1/.../kanye.webp`. That path works for the
thumbnail in the left rail (the browser resolves it against the current origin), but it is
sent to Lucy verbatim as `reference_image_url`. Lucy runs on fal's servers, where a
relative path resolves to nothing — so the edit either lands without the reference or the
apply fails ("Lucy signaling failed" in the screenshots).

User-uploaded reference images already work because they are uploaded to the Supabase
`refs` bucket and sent as a signed absolute URL.

## The fix

Make preset references take the exact same path as user uploads:

1. When a preset with a reference image is applied, fetch the asset bytes from the
   relative CDN path (same-origin, cheap and cached).
2. Upload it once to the `refs` bucket under a deterministic key derived from the asset
   id, then create a signed URL and send that to Lucy.
3. Cache the resolved signed URL per preset in memory so repeated clicks on the same
   preset are instant, with no second upload or fetch.
4. If the fetch/upload fails, fall back to a base64 data URI (the existing fallback used
   for uploads) so the preset still works rather than silently dropping the reference.
5. Keep the left-rail thumbnail on the original relative path — that part is fine.

While resolving, the preset button shows its normal active state; the prompt is only sent
after the reference URL is ready so Lucy never receives a half-applied edit.

## Technical notes

- Changes are confined to `src/routes/index.tsx`: `loadPresetRef` becomes async
  (fetch → `supabase.storage.from("refs").upload(...)` → `createSignedUrl`), and
  `applyPreset` awaits it before calling `applyPrompt`.
- Reuses the exact upload/sign logic already in `onRefUpload`, extracted into one small
  helper so both paths stay in sync.
- No schema or preset-row changes needed; no other UI files touched.

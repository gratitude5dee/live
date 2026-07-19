# /library — TikTok Feed + Selectable List

Rebuild `/library` with two toggleable view modes and multi-select for bulk download / delete. Keeps the existing LiquidEther + ShinyText + GlassSurface aesthetic.

## View modes (top-right toggle next to filter pills)

1. **Feed** — TikTok-style. Full-viewport 9:16 vertical scroll-snap deck of takes.
2. **Grid** — current card grid (default on desktop, retained).
3. **List** — dense table-like rows with checkboxes, thumbnail, filename, date, size, duration, and per-row download.

Persist choice in `localStorage("zap.library.view")`. Default: `feed` on mobile, `grid` on desktop.

## Feed mode

- Vertical `snap-y snap-mandatory` scroll container, one take per screen.
- Video autoplays (muted, loop, playsInline) when its slide is >60% visible via `IntersectionObserver`; pauses on exit. Only one active at a time.
- Tap to toggle mute; long-press / double-tap to like (local only for now).
- Right rail overlay (floating, glass): download, delete, select-checkmark, share (copies signed URL), timestamp.
- Snapshots (`kind === 'image'`) get the Ken-Burns slow zoom treatment so they feel alive in-feed.
- Keyboard: `↑/↓` = prev/next, `m` = mute, `d` = download, `x` = delete, `space` = play/pause.

## List mode

- Rows with a leading checkbox, 48×80 thumbnail (video poster frame captured client-side via `<video>` seek to 0.1s onto a canvas), filename, `kind` chip, created date, duration (formatted from `duration_ms`), size (from `size_bytes`), and per-row download button.
- Header row has a master checkbox (select all / none in current filter).
- Sort by date desc; click column header (Date / Size / Duration) to toggle sort.

## Multi-select + bulk actions (all modes)

- Selection state lives in a `Set<number>` of take ids, shared across views.
- Floating action bar (bottom center, glass) appears when `selected.size > 0`:
  - `N selected`
  - **Download all** → sequentially triggers signed-URL downloads (anchor click loop with 150ms spacing to avoid browser throttling). For >3 items, offer **Download as ZIP** using `client-zip` (streams, tiny, no deps beyond ~3KB). Adds `bun add client-zip`.
  - **Delete** → confirm, then `Promise.all` remove from storage + rows.
  - **Clear**.
- Checkmark UI: grid cards get a top-right circular checkbox that fills cyan when selected + adds a `ring-2 ring-cyan-300` frame. Feed slides get a floating check on the right rail. List rows use the leading checkbox.

## Data / fetch tweaks

- Keep the existing single-shot fetch, but chunk signed-URL creation into `Promise.all` batches of 20 (already fast enough for 120).
- Add `kind` filter counts already present; add a `duration_ms`/`size_bytes` formatter util in-file.
- No schema changes. No new server functions.

## Files touched

- `src/routes/library.tsx` — rewrite in place. Split into small internal components: `ViewToggle`, `FeedView`, `GridView` (extracted from current), `ListView`, `BulkBar`, `SelectCheck`.
- `package.json` — add `client-zip` (only if ZIP download is kept; ~3KB, MIT).

## Out of scope

- No backend pagination (120-row limit stays).
- No renaming / tagging (nice-to-have, ask later).
- No per-user "likes" persistence.

## Technical notes

- `IntersectionObserver` with `threshold: [0, 0.6, 1]` on each feed slide; a single `ref` map keyed by take id drives play/pause.
- Poster generation: create hidden `<video crossOrigin="anonymous" preload="metadata">`, on `loadeddata` seek to `0.1`, draw to `<canvas>` at 96×160, `toDataURL('image/jpeg', 0.6)`, cache in a `Map` keyed by take id.
- ZIP: `import { downloadZip } from 'client-zip'`; feed it `[{ name, input: await fetch(url) }, ...]`, then `URL.createObjectURL(await zip.blob())`.
- Preserve `LiquidEther` background — reduce opacity behind Feed mode to 30% so video content dominates.
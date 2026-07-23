# Global Takes on /library

Add a public "Global" scope to the Archive page so anyone (including anon sign-ins) can browse every clip ever recorded, alongside their own "Yours" takes.

## UX

Add a scope toggle in the sticky control bar, right next to the existing All/Video/Snapshot filter:

```text
[ Yours · Global ]   All  Video  Snapshot          [ Feed | Grid | List ]
```

- Default: **Yours** (current behavior — user's own takes).
- **Global**: fetches the latest 120 takes across all users, newest first.
- Kind filter (All/Video/Snapshot) and view mode (Feed/Grid/List) apply to both scopes.
- In Global scope:
  - Selection checkboxes, bulk delete, and per-item delete are hidden (read-only).
  - Bulk download / ZIP still work.
  - Hero copy switches: title becomes "Everyone's *takes.*", subtitle "A public reel of every session Zap has ever repainted."
  - Each card gets a small anonymized author chip (e.g. `USR·a1b2` — first 4 chars of user_id) so the feed feels populated, no PII.
- Scope choice is persisted in `localStorage` (`zap.library.scope`).

## Backend (one migration)

Currently `takes` RLS and the private `takes` storage bucket only allow the owner to read. To expose a public feed we add read-only public access:

1. `public.takes` — add a policy allowing anyone (anon + authenticated) to `SELECT` all rows. Keep existing owner-only `ALL` policy for insert/update/delete.
2. Storage `takes` bucket — add a policy on `storage.objects` allowing public `SELECT` for objects in the `takes` bucket, so `createSignedUrl` (and public URLs) resolve for other users' files. Bucket stays private on the write side (owner-only insert via existing scoped policy).

No schema changes, no new tables.

## Frontend changes (src/routes/library.tsx only)

- New `Scope = "mine" | "global"` state + persistence.
- `useEffect` loader keys on `scope`:
  - `mine`: unchanged query.
  - `global`: `.from("takes").select("*").order("created_at",{ascending:false}).limit(120)` (no user filter — RLS allows all).
- Hide selection UI, delete buttons, and CommandBar delete action when `scope === "global"`.
- Add anonymized author badge derived from `user_id.slice(0,4)`.
- Hero title/subtitle swap based on scope.
- Add `ScopeSegmented` control in `ControlBar` (mirrors `ViewSegmented` styling).

## Out of scope

- No profiles, usernames, avatars, likes, reports, or moderation tooling.
- No pagination beyond the existing 120-row cap (matches current behavior).
- No realtime subscription — page load fetch only.

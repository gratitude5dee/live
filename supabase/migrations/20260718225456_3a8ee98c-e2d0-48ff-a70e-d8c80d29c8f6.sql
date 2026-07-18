
-- SESSIONS
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  transport text check (transport in ('webrtc','frame')),
  stats jsonb not null default '{}'::jsonb
);
create index sessions_user_id_idx on public.sessions (user_id);
grant select, insert, update, delete on public.sessions to authenticated;
grant all on public.sessions to service_role;
alter table public.sessions enable row level security;
alter table public.sessions force row level security;
create policy sessions_own on public.sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- PROMPT EVENTS
create table public.prompt_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('apply','undo','clear','preset','reactive')),
  source text not null check (source in ('text','gesture','face','preset','remote')),
  prompt text,
  ref_image_path text,
  at_ms integer not null,
  created_at timestamptz not null default now()
);
create index prompt_events_session_idx on public.prompt_events (session_id, at_ms);
create index prompt_events_user_idx on public.prompt_events (user_id);
grant select, insert, update, delete on public.prompt_events to authenticated;
grant all on public.prompt_events to service_role;
alter table public.prompt_events enable row level security;
alter table public.prompt_events force row level security;
create policy prompt_events_own on public.prompt_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- VISION EVENTS
create table public.vision_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('gesture','face')),
  label text not null,
  score real not null,
  action text,
  at_ms integer not null,
  created_at timestamptz not null default now()
);
create index vision_events_session_idx on public.vision_events (session_id, at_ms);
create index vision_events_user_idx on public.vision_events (user_id);
grant select, insert, update, delete on public.vision_events to authenticated;
grant all on public.vision_events to service_role;
alter table public.vision_events enable row level security;
alter table public.vision_events force row level security;
create policy vision_events_own on public.vision_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- TAKES
create table public.takes (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('video','snapshot')),
  storage_path text not null,
  duration_ms integer,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index takes_session_idx on public.takes (session_id);
create index takes_user_idx on public.takes (user_id);
grant select, insert, update, delete on public.takes to authenticated;
grant all on public.takes to service_role;
alter table public.takes enable row level security;
alter table public.takes force row level security;
create policy takes_own on public.takes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- PRESETS (built-in rows have user_id null)
create table public.presets (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null,
  prompt text not null,
  requires_ref boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
create index presets_user_id_idx on public.presets (user_id);
grant select, insert, update, delete on public.presets to authenticated;
grant all on public.presets to service_role;
alter table public.presets enable row level security;
alter table public.presets force row level security;
create policy presets_read on public.presets
  for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);
create policy presets_insert on public.presets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy presets_delete on public.presets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- TOKEN MINTS (rate-limit audit)
create table public.token_mints (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  minted_at timestamptz not null default now()
);
create index token_mints_rate_idx on public.token_mints (user_id, minted_at);
grant select, insert on public.token_mints to authenticated;
grant all on public.token_mints to service_role;
alter table public.token_mints enable row level security;
alter table public.token_mints force row level security;
create policy token_mints_own on public.token_mints
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- SEED BUILT-IN PRESETS
insert into public.presets (user_id, name, emoji, prompt, requires_ref, sort_order) values
(null, 'Beach', '🌴', 'Change the background to a sandy beach with waves gently crashing on the shore and sunlight reflecting on the water. Keep the person''s identity, face, and clothing unchanged.', false, 10),
(null, 'Neon City', '🌆', 'Change the background to a neon-lit city street at night with glowing signs, light rain, and reflections on wet pavement. Keep the person''s identity, face, and clothing unchanged.', false, 20),
(null, 'Anime', '🎌', 'Transform the entire scene into an anime style. The final video should show bold clean linework, flat cel-shaded color blocks, vibrant saturated colors, and simplified backgrounds, while preserving the original subjects, layout, and motion.', false, 30),
(null, 'Watercolor', '🎨', 'Transform the entire scene into a watercolor painting style. The final video should show soft translucent color washes, visible paper texture, loose ink outlines, and muted pastel colors, while preserving the original subjects, layout, and motion.', false, 40),
(null, 'Sketch', '✏️', 'Transform the entire scene into a charcoal sketch style. The final video should show rough graphite shading, visible paper texture, loose hatching, and high-contrast black-and-white tones, while preserving the original subjects, layout, and motion.', false, 50),
(null, 'Fire Hands', '🔥', 'Add glowing orange fireballs to the person''s hands, trailing with their hand motion and casting warm light on their fingers and face.', false, 60),
(null, 'Crown', '👑', 'Add a silver crown with small blue gems floating just above the person''s head, following their head movement.', false, 70),
(null, 'Cyberpunk', '🕶️', 'Change the style of the video to a dark cyberpunk aesthetic with teal and magenta color grading, while preserving the original subjects, layout, and motion.', false, 80),
(null, 'Clean Studio', '🧹', 'Change the background to a smooth, evenly lit light-gray studio wall. Keep the person''s identity, face, and clothing unchanged.', false, 90),
(null, 'Try-On', '🧥', 'Replace the person''s top with the garment from the reference image, including its color, texture, and fit. Keep the person''s identity, face, and hair unchanged.', true, 100);


alter table public.prompt_events drop constraint if exists prompt_events_source_check;
alter table public.prompt_events add constraint prompt_events_source_check
  check (source in ('text','gesture','face','preset','remote','voice'));

create table public.voice_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null,
  transcript text,
  wake_detected boolean not null default true,
  edit_type text check (edit_type in ('character_transformation','add_object','replace_object','change_attribute','remove_object','change_background','restyle_video')),
  lucy_prompt text,
  ack_word text,
  latency_ms integer,
  at_ms integer not null,
  created_at timestamptz not null default now()
);

grant select, insert on public.voice_events to authenticated;
grant all on public.voice_events to service_role;

alter table public.voice_events enable row level security;

create policy voice_events_own on public.voice_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index voice_events_session_idx on public.voice_events (session_id, at_ms);

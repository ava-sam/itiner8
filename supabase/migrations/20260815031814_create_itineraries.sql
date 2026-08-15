-- Itineraries: one row per Generate Plan attempt. Every generation is
-- kept (no overwrite) — the "current" plan is whichever row has the
-- latest generated_at per hangout, computed at query time. Stops with
-- conflicts stay in the plan; conflicts are surfaced as warnings.

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),

  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  generated_by uuid not null references public.profiles(id),

  transportation_mode text not null,

  stops jsonb not null,
  conflicts jsonb not null default '[]',

  generated_at timestamptz not null default now()
);

alter table public.itineraries enable row level security;

create policy "itineraries_select_members"
  on public.itineraries for select
  using (
    public.is_hangout_organizer(hangout_id)
    or public.is_hangout_member(hangout_id)
  );

create policy "itineraries_insert_organizer_only"
  on public.itineraries for insert
  with check (
    generated_by = auth.uid()
    and public.is_hangout_organizer(hangout_id)
  );

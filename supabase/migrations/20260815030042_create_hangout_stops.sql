-- Per-hangout candidate places: links a cached place to a hangout,
-- tracks who suggested it, its status, and scheduling constraints.

create table public.hangout_stops (
  id uuid primary key default gen_random_uuid(),

  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  place_id uuid not null references public.places(id),
  suggested_by uuid not null references public.profiles(id),

  status text not null default 'candidate'
    check (status in ('candidate', 'selected', 'planned', 'completed', 'skipped')),

  is_required boolean not null default false,

  reservation_time timestamptz,
  preferred_start timestamptz,
  preferred_end timestamptz,
  visit_duration_minutes integer not null check (visit_duration_minutes > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (hangout_id, place_id)
);

alter table public.hangout_stops enable row level security;

create policy "hangout_stops_select_members"
  on public.hangout_stops for select
  using (
    public.is_hangout_organizer(hangout_id)
    or public.is_hangout_member(hangout_id)
  );

create policy "hangout_stops_insert_members"
  on public.hangout_stops for insert
  with check (
    suggested_by = auth.uid()
    and (
      public.is_hangout_organizer(hangout_id)
      or public.is_hangout_member(hangout_id)
    )
  );

create policy "hangout_stops_update_own_or_organizer"
  on public.hangout_stops for update
  using (
    suggested_by = auth.uid()
    or public.is_hangout_organizer(hangout_id)
  )
  with check (
    suggested_by = auth.uid()
    or public.is_hangout_organizer(hangout_id)
  );

create policy "hangout_stops_delete_own_or_organizer"
  on public.hangout_stops for delete
  using (
    suggested_by = auth.uid()
    or public.is_hangout_organizer(hangout_id)
  );

create trigger on_hangout_stop_updated
  before update on public.hangout_stops
  for each row execute function public.handle_updated_at();

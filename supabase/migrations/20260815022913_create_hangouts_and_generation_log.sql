-- hangouts: one row per planned hangout
create table public.hangouts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'planning'
    check (status in ('planning', 'generated', 'finalized', 'completed')),
  start_time timestamptz not null,
  end_time timestamptz,
  start_location jsonb not null,
  end_location jsonb,
  transportation_mode text not null default 'driving'
    check (transportation_mode in ('driving', 'walking', 'transit')),
  buffer_minutes int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_time is null or end_time > start_time)
);

alter table public.hangouts enable row level security;

-- Temporary: organizer-only visibility. Will be broadened to include invited
-- members once the hangout_members table exists (next migration).
create policy "Organizers can view their own hangouts"
  on public.hangouts for select
  using (auth.uid() = organizer_id);

-- Guests (anonymous users) cannot create hangouts — only account holders.
create policy "Account holders can create hangouts"
  on public.hangouts for insert
  with check (
    auth.uid() = organizer_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Organizers can update their own hangouts"
  on public.hangouts for update
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

create policy "Organizers can delete their own hangouts"
  on public.hangouts for delete
  using (auth.uid() = organizer_id);

create trigger on_hangout_updated
  before update on public.hangouts
  for each row execute function public.handle_updated_at();

-- generation_log: tracks each Generate Plan press, for the 10x/day-per-hangout cap
create table public.generation_log (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  generated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.generation_log enable row level security;

create policy "Organizers can view their hangout's generation log"
  on public.generation_log for select
  using (
    exists (
      select 1 from public.hangouts
      where hangouts.id = generation_log.hangout_id
        and hangouts.organizer_id = auth.uid()
    )
  );

create policy "Organizers can log a generation for their own hangout"
  on public.generation_log for insert
  with check (
    generated_by = auth.uid()
    and exists (
      select 1 from public.hangouts
      where hangouts.id = generation_log.hangout_id
        and hangouts.organizer_id = auth.uid()
    )
  );

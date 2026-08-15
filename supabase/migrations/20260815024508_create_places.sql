-- places: candidate locations suggested during hangout planning
create table public.places (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  google_place_id text not null,
  name text not null check (char_length(name) between 1 and 200),
  address text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'candidate'
    check (status in ('candidate', 'finalist', 'selected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.places enable row level security;

create policy "Hangout members can view places"
  on public.places for select
  using (public.is_hangout_organizer(hangout_id) or public.is_hangout_member(hangout_id));

create policy "Hangout members can suggest places"
  on public.places for insert
  with check (
    suggested_by = auth.uid()
    and (public.is_hangout_organizer(hangout_id) or public.is_hangout_member(hangout_id))
  );

create policy "Suggesters can update their own place"
  on public.places for update
  using (suggested_by = auth.uid())
  with check (suggested_by = auth.uid());

create policy "Organizers can update any place in their hangout"
  on public.places for update
  using (public.is_hangout_organizer(hangout_id))
  with check (public.is_hangout_organizer(hangout_id));

create policy "Suggesters can remove their own place"
  on public.places for delete
  using (suggested_by = auth.uid());

create policy "Organizers can remove any place in their hangout"
  on public.places for delete
  using (public.is_hangout_organizer(hangout_id));

create trigger on_place_updated
  before update on public.places
  for each row execute function public.handle_updated_at();

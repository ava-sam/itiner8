-- Global deduplicated cache of place data (Google-sourced or custom),
-- shared across all hangouts. Per-hangout usage lives in hangout_stops.

create table public.places (
  id uuid primary key default gen_random_uuid(),

  google_place_id text unique,
  is_custom boolean not null default false,

  name text not null check (char_length(name) between 1 and 255),
  formatted_address text not null,

  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),

  opening_hours jsonb,
  utc_offset_minutes integer,
  primary_type text,
  google_maps_uri text,

  cached_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint places_source_check check (
    (is_custom = false and google_place_id is not null)
    or
    (is_custom = true)
  )
);

alter table public.places enable row level security;

-- Any signed-in user (account or guest) can view the shared cache
create policy "places_select_authenticated"
  on public.places for select
  to authenticated
  using (true);

-- Any signed-in user can add a new place to the cache
create policy "places_insert_authenticated"
  on public.places for insert
  to authenticated
  with check (true);

-- Refresh is only allowed once the cached data is past the 30-day
-- Google Maps Platform caching window — enforced at the DB level
create policy "places_update_stale_only"
  on public.places for update
  to authenticated
  using (cached_at < now() - interval '30 days')
  with check (true);

-- No delete policy: deletes are denied for everyone

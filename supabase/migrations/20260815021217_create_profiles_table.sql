-- profiles: one row per user (account holders and guests alike)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user (account or guest) can see display names — needed to show
-- who suggested a place, who voted, who's in a hangout.
create policy "Profiles are viewable by any signed-in user"
  on public.profiles for select
  using (auth.uid() is not null);

-- Users can only edit their own profile.
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policies — rows are created only by the trigger below,
-- which runs as security definer and bypasses RLS. Users can't insert or
-- delete profile rows directly.

-- Auto-create a profile whenever a new auth user appears (real or anonymous).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Guest')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current on every edit.
create function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

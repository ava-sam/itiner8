-- hangout_members: who belongs to a hangout, and in what role
create table public.hangout_members (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 50),
  role text not null default 'member' check (role in ('organizer', 'member')),
  created_at timestamptz not null default now(),
  constraint member_identity_present check (profile_id is not null or display_name is not null)
);

-- Prevent the same profile from being added twice to the same hangout.
create unique index hangout_members_unique_profile
  on public.hangout_members (hangout_id, profile_id)
  where profile_id is not null;

alter table public.hangout_members enable row level security;

-- Reusable helpers, security definer so they can check membership without
-- re-triggering RLS on themselves (avoids recursive-policy pitfalls).
create function public.is_hangout_organizer(p_hangout_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.hangouts
    where id = p_hangout_id and organizer_id = auth.uid()
  );
$$;

create function public.is_hangout_member(p_hangout_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.hangout_members
    where hangout_id = p_hangout_id and profile_id = auth.uid()
  );
$$;

create policy "Members can view their hangout's member list"
  on public.hangout_members for select
  using (public.is_hangout_organizer(hangout_id) or public.is_hangout_member(hangout_id));

create policy "Organizers can add members to their hangout"
  on public.hangout_members for insert
  with check (public.is_hangout_organizer(hangout_id));

create policy "Users can add themselves as a member"
  on public.hangout_members for insert
  with check (profile_id = auth.uid());

create policy "Organizers can update member rows"
  on public.hangout_members for update
  using (public.is_hangout_organizer(hangout_id))
  with check (public.is_hangout_organizer(hangout_id));

create policy "Members can update their own row"
  on public.hangout_members for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "Organizers can remove members"
  on public.hangout_members for delete
  using (public.is_hangout_organizer(hangout_id));

create policy "Members can remove themselves"
  on public.hangout_members for delete
  using (profile_id = auth.uid());

-- Auto-add the organizer as a member row whenever a hangout is created.
create function public.handle_new_hangout()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.hangout_members (hangout_id, profile_id, role)
  values (new.id, new.organizer_id, 'organizer');
  return new;
end;
$$;

create trigger on_hangout_created
  after insert on public.hangouts
  for each row execute function public.handle_new_hangout();

-- Broaden hangouts visibility: members can now see hangouts they belong to,
-- in addition to the organizer-only policy from the previous migration.
-- (Postgres OR's multiple permissive policies together — this doesn't
-- replace the earlier one, it adds to it.)
create policy "Members can view hangouts they belong to"
  on public.hangouts for select
  using (public.is_hangout_member(id));

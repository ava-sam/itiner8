-- Votes: one upvote per person per hangout stop. Row existence is the
-- vote; removing it is a delete. Vote counts computed at read time.

create table public.votes (
  id uuid primary key default gen_random_uuid(),

  hangout_stop_id uuid not null references public.hangout_stops(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),

  created_at timestamptz not null default now(),

  unique (hangout_stop_id, voter_id)
);

alter table public.votes enable row level security;

create policy "votes_select_members"
  on public.votes for select
  using (
    exists (
      select 1 from public.hangout_stops hs
      where hs.id = hangout_stop_id
        and (
          public.is_hangout_organizer(hs.hangout_id)
          or public.is_hangout_member(hs.hangout_id)
        )
    )
  );

create policy "votes_insert_own"
  on public.votes for insert
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.hangout_stops hs
      where hs.id = hangout_stop_id
        and (
          public.is_hangout_organizer(hs.hangout_id)
          or public.is_hangout_member(hs.hangout_id)
        )
    )
  );

create policy "votes_delete_own"
  on public.votes for delete
  using (voter_id = auth.uid());

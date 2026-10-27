create table public.join_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index join_attempts_user_time_idx
  on public.join_attempts (user_id, created_at desc);

alter table public.join_attempts enable row level security;
revoke all on public.join_attempts from anon, authenticated;

-- Preview: minimal plan details for a code. Never raises, so failures get logged.
create or replace function public.preview_hangout(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_hangout public.hangouts%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  if (
    select count(*) from public.join_attempts
    where user_id = v_uid
      and succeeded = false
      and created_at > now() - interval '1 hour'
  ) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into v_hangout
  from public.hangouts
  where invite_code = v_code
    and status in ('planning', 'generated');

  if not found then
    insert into public.join_attempts (user_id, succeeded) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  return jsonb_build_object(
    'ok', true,
    'name', v_hangout.name,
    'organizer_name', (
      select display_name from public.profiles where id = v_hangout.organizer_id
    ),
    'start_time', v_hangout.start_time,
    'member_count', (
      select count(*) from public.hangout_members where hangout_id = v_hangout.id
    )
  );
end;
$$;

-- Join: add the caller as a member.
create or replace function public.join_hangout(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_hangout_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  if (
    select count(*) from public.join_attempts
    where user_id = v_uid
      and succeeded = false
      and created_at > now() - interval '1 hour'
  ) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select id into v_hangout_id
  from public.hangouts
  where invite_code = v_code
    and status in ('planning', 'generated');

  if v_hangout_id is null then
    insert into public.join_attempts (user_id, succeeded) values (v_uid, false);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  insert into public.hangout_members (hangout_id, profile_id, role, display_name)
  select v_hangout_id, v_uid, 'member', p.display_name
  from public.profiles p
  where p.id = v_uid
  on conflict (hangout_id, profile_id) where profile_id is not null do nothing;

  insert into public.join_attempts (user_id, succeeded) values (v_uid, true);

  return jsonb_build_object('ok', true, 'hangout_id', v_hangout_id);
end;
$$;

-- Organizer-only: replace the invite code (old code stops working).
create or replace function public.regenerate_invite_code(p_hangout_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_new text;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  if not exists (
    select 1 from public.hangouts
    where id = p_hangout_id and organizer_id = v_uid
  ) then
    raise exception 'not_organizer';
  end if;

  v_new := public.generate_invite_code();
  update public.hangouts set invite_code = v_new where id = p_hangout_id;
  return v_new;
end;
$$;

revoke execute on function public.preview_hangout(text) from public, anon;
revoke execute on function public.join_hangout(text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.preview_hangout(text) to authenticated;
grant execute on function public.join_hangout(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

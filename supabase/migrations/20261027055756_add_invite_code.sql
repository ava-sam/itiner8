create extension if not exists pgcrypto with schema extensions;

-- 8-char code, alphabet has no 0/O/1/I/L (31 symbols)
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  bytes bytea;
  i int;
begin
  loop
    code := '';
    bytes := extensions.gen_random_bytes(8);
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;
    exit when not exists (
      select 1 from public.hangouts where invite_code = code
    );
  end loop;
  return code;
end;
$$;

revoke execute on function public.generate_invite_code() from public, anon;
grant execute on function public.generate_invite_code() to authenticated;

alter table public.hangouts add column invite_code text;

update public.hangouts
set invite_code = public.generate_invite_code()
where invite_code is null;

alter table public.hangouts
  alter column invite_code set default public.generate_invite_code();
alter table public.hangouts alter column invite_code set not null;
alter table public.hangouts
  add constraint hangouts_invite_code_key unique (invite_code);
alter table public.hangouts
  add constraint hangouts_invite_code_format
  check (invite_code ~ '^[A-HJKMNP-Z2-9]{8}$');

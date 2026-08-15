create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(left(new.raw_user_meta_data->>'display_name', 50)), ''), 'Guest')
  );
  return new;
end;
$$;

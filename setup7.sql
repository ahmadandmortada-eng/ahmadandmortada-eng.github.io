-- =====================================================================
-- User profiles: every customer has a username and a public page rassim.shop/<username>
-- (run once, after setup6.sql)
-- =====================================================================

create or replace function public.is_reserved_username(p text)
returns boolean language sql immutable as $$
  select lower(p) = any (array['admin','administrator','root','support','shop','browse','product','products','feedbacks','feedback','account',
    'login','logout','signup','register','buy','profile','user','users','settings','api','help','about','contact','terms','privacy','rassim',
    'resemblance','resemblanced','shopixx','index','null','undefined','www','mail','official','staff','moderator','orders','order','cart','checkout','home']);
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  bio text,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_bio_len check (bio is null or char_length(bio) <= 200)
);
create unique index profiles_username_key on public.profiles (username);
alter table public.profiles enable row level security;

create policy "see own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "create own profile" on public.profiles for insert
  with check (id = auth.uid() and (not public.is_reserved_username(username) or public.is_admin()));
create policy "edit own profile" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and (not public.is_reserved_username(username) or public.is_admin()));
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- what the public page shows: username, bio, join date, number of paid orders (no email, no ids)
create or replace view public.profiles_public as
select p.username, p.bio, p.created_at,
  (select count(*) from public.orders o where o.user_id = p.id and o.status = 'paid')::int as purchases
from public.profiles p;
grant select on public.profiles_public to anon, authenticated;

-- creates the profile at sign-up from the username typed in the form (never blocks the sign-up)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare n text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
begin
  if n ~ '^[a-z0-9_]{3,20}$' and not public.is_reserved_username(n) then
    begin
      insert into public.profiles (id, username) values (new.id, n);
    exception when others then null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

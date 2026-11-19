-- =====================================================================
-- Resemblance shop: database setup (run once in Supabase > SQL Editor)
-- =====================================================================

-- 1) Who is an admin (only you)
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
create policy "admins can read their own row" on public.admins
  for select using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 2) Products (public: visitors can only SEE active ones; only admins can write)
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('tiktok_username','instagram_username','gift_card','digital_product')),
  title       text not null check (char_length(title) between 1 and 120),
  description text,
  price_dzd   integer not null check (price_dzd >= 0),
  image_url   text,
  details     jsonb not null default '{}'::jsonb,   -- template fields (handle, brand, value, region...)
  is_active   boolean not null default true,
  is_sold     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.products enable row level security;

create policy "anyone sees active products" on public.products
  for select using (is_active or public.is_admin());
create policy "admin adds products" on public.products
  for insert with check (public.is_admin());
create policy "admin edits products" on public.products
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes products" on public.products
  for delete using (public.is_admin());

-- 3) Hidden delivery content (codes / account details). Nobody but admins can ever read this.
create table public.product_secrets (
  product_id uuid primary key references public.products(id) on delete cascade,
  content    text not null
);
alter table public.product_secrets enable row level security;
create policy "admin only" on public.product_secrets
  for all using (public.is_admin()) with check (public.is_admin());

-- 4) AFTER you create your account (Authentication > Users > Add user), make it admin.
--    Use the same email you created the account with:
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'xfosto9@gmail.com';

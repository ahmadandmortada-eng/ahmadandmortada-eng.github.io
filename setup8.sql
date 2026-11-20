-- =====================================================================
-- Verified reviews after purchase + richer profiles (run once, after setup7.sql)
-- =====================================================================

-- 1) Profile extras
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists instagram text;
alter table public.profiles add column if not exists tiktok text;
alter table public.profiles add column if not exists avatar_emoji text;
alter table public.profiles add column if not exists avatar_hue integer;
alter table public.profiles add constraint profiles_display_len check (display_name is null or char_length(display_name) <= 30);
alter table public.profiles add constraint profiles_country_len check (country is null or char_length(country) <= 40);
alter table public.profiles add constraint profiles_ig_fmt check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
alter table public.profiles add constraint profiles_tt_fmt check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{1,30}$');
alter table public.profiles add constraint profiles_emoji_len check (avatar_emoji is null or char_length(avatar_emoji) between 1 and 8);
alter table public.profiles add constraint profiles_hue_ok check (avatar_hue is null or avatar_hue between 0 and 360);

-- 2) Feedbacks written by buyers (verified = linked to a paid order, one per order, shown after you approve it)
alter table public.feedbacks add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.feedbacks add column if not exists order_id uuid references public.orders(id) on delete set null;
create unique index if not exists feedbacks_one_per_order on public.feedbacks (order_id) where order_id is not null;
create policy "buyers see their own feedbacks" on public.feedbacks for select using (user_id = auth.uid());

create or replace function public.submit_feedback(p_order uuid, p_rating integer, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; uname text;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() and status = 'paid';
  if not found then raise exception 'You can only review an order you have paid.'; end if;
  if exists (select 1 from public.feedbacks where order_id = p_order) then raise exception 'You already reviewed this order.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose a rating from 1 to 5.'; end if;
  if p_comment is null or char_length(trim(p_comment)) not between 1 and 600 then raise exception 'Write a short feedback (up to 600 characters).'; end if;
  select username into uname from public.profiles where id = auth.uid();
  insert into public.feedbacks (product_id, product_title, author, rating, comment, is_visible, user_id, order_id)
  values (o.product_id, o.product_title, coalesce(uname, 'customer'), p_rating, trim(p_comment), false, auth.uid(), o.id);
end $$;
grant execute on function public.submit_feedback(uuid, integer, text) to authenticated;

-- public list of approved feedbacks (no user ids)
create or replace view public.feedbacks_public as
select id, product_id, product_title, author, rating, comment, created_at, (order_id is not null) as verified
from public.feedbacks where is_visible;
grant select on public.feedbacks_public to anon, authenticated;

-- 3) Public profile data (new columns are added at the end)
create or replace view public.profiles_public as
select p.username, p.bio, p.created_at,
  (select count(*) from public.orders o where o.user_id = p.id and o.status = 'paid')::int as purchases,
  p.display_name, p.country, p.instagram, p.tiktok, p.avatar_emoji, p.avatar_hue,
  (select count(*) from public.feedbacks f where f.user_id = p.id and f.is_visible)::int as reviews,
  (select round(avg(f.rating)::numeric, 1) from public.feedbacks f where f.user_id = p.id and f.is_visible) as avg_rating
from public.profiles p;
grant select on public.profiles_public to anon, authenticated;

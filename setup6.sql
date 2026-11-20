-- =====================================================================
-- Launch update (run once, after setup5.sql):
-- currency per product (DZD/USD), minimum quantity, totals, allowed payment methods per product,
-- promo codes, feedbacks, and product page links (slugs)
-- =====================================================================

-- 1) Products
alter table public.products add column if not exists price numeric(12,2);
alter table public.products add column if not exists currency text not null default 'DZD';
alter table public.products add column if not exists min_qty integer not null default 1;
alter table public.products add column if not exists pay_methods text[] not null default '{baridimob,crypto}';
alter table public.products add column if not exists slug text;

update public.products set price = price_dzd where price is null;
update public.products
  set slug = coalesce(nullif(trim(both '-' from lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'item') || '-' || substr(id::text, 1, 4)
  where slug is null;
alter table public.products alter column price set not null;
alter table public.products alter column price_dzd drop not null;
alter table public.products add constraint products_price_nonneg check (price >= 0);
alter table public.products add constraint products_currency_ok check (currency in ('DZD','USD'));
alter table public.products add constraint products_min_qty_ok check (min_qty >= 1);
alter table public.products add constraint products_methods_ok check (pay_methods <@ array['baridimob','crypto']::text[] and cardinality(pay_methods) >= 1);
create unique index if not exists products_slug_key on public.products (slug);

-- 2) Orders: quantity, currency, totals, promo
alter table public.orders add column if not exists qty integer not null default 1 check (qty >= 1);
alter table public.orders add column if not exists currency text not null default 'DZD';
alter table public.orders add column if not exists unit_price numeric(12,2);
alter table public.orders add column if not exists amount numeric(12,2);       -- total in the product currency
alter table public.orders add column if not exists amount_usd numeric(12,2);   -- total in USD (crypto)
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists discount_pct integer not null default 0;
update public.orders set amount = amount_dzd, unit_price = amount_dzd where amount is null;

-- 3) Promo codes
create table public.promo_codes (
  code text primary key,
  percent integer not null check (percent between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
create policy "admin manages promo codes" on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.promo_codes to authenticated;
grant all on public.promo_codes to service_role;
insert into public.promo_codes (code, percent) values ('RDX', 20) on conflict do nothing;

create or replace function public.check_promo(p_code text)
returns integer language sql security definer set search_path = public stable as $$
  select percent from public.promo_codes where upper(code) = upper(trim(p_code)) and is_active;
$$;
grant execute on function public.check_promo(text) to anon, authenticated;

-- 4) Feedbacks (added by you, shown on /feedbacks and on the product page)
create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_title text,
  author text not null check (char_length(author) between 1 and 60),
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 1 and 600),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.feedbacks enable row level security;
create policy "anyone reads visible feedbacks" on public.feedbacks for select using (is_visible or public.is_admin());
create policy "admin writes feedbacks" on public.feedbacks for all using (public.is_admin()) with check (public.is_admin());
grant select on public.feedbacks to anon, authenticated;
grant insert, update, delete on public.feedbacks to authenticated;
grant all on public.feedbacks to service_role;

-- 5) Public product list (adds price/currency/min qty/methods/slug; "sold" now counts units)
create or replace view public.products_public as
select p.id, p.category, p.title, p.description, p.price_dzd, p.image_url, p.details, p.created_at, p.stock,
  greatest(p.stock - coalesce((
    select sum(o.qty) from public.orders o
    where o.product_id = p.id and (o.status = 'awaiting_review' or (o.status = 'pending' and o.expires_at > now()))
  ), 0), 0)::int as available,
  coalesce((select sum(o.qty) from public.orders o where o.product_id = p.id and o.status = 'paid'), 0)::int as sold,
  p.price, p.currency, p.min_qty, p.pay_methods, p.slug
from public.products p where p.is_active;
grant select on public.products_public to anon, authenticated;

-- 6) Creating an order: quantity, minimum, allowed method, promo code, totals
drop function if exists public.create_order(uuid, text);
create or replace function public.create_order(p_product uuid, p_method text, p_qty integer default 1, p_promo text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare pr public.products; o public.orders; held int; rate numeric; pct int := 0; v_code text := null;
        cur numeric; total numeric; usd numeric; dzd numeric;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 1000 then raise exception 'Invalid quantity.'; end if;
  update public.orders set status = 'expired' where status = 'pending' and expires_at < now();

  select * into pr from public.products where id = p_product and is_active for update;   -- locks this product
  if not found or pr.stock <= 0 then raise exception 'This item is sold out.'; end if;
  if not (p_method = any (pr.pay_methods)) then raise exception 'This payment method is not available for this item.'; end if;
  if p_qty < pr.min_qty then raise exception 'The minimum order for this item is % units.', pr.min_qty; end if;

  -- this buyer's existing open order: keep it if it is under review or already has a payment address, otherwise replace it
  select * into o from public.orders where product_id = pr.id and user_id = auth.uid() and status in ('pending','awaiting_review') limit 1;
  if found then
    if o.status = 'awaiting_review' or o.provider_payment_id is not null then return o; end if;
    update public.orders set status = 'cancelled' where id = o.id;
  end if;

  select coalesce(sum(qty), 0) into held from public.orders where product_id = pr.id and status in ('pending','awaiting_review');
  if p_qty > pr.stock - held then raise exception 'Only % unit(s) available right now.', greatest(pr.stock - held, 0); end if;

  select value::numeric into rate from public.settings where key = 'dzd_per_usd';
  if rate is null or rate <= 0 then raise exception 'Exchange rate is not set.'; end if;

  if p_promo is not null and trim(p_promo) <> '' then
    select percent, upper(code) into pct, v_code from public.promo_codes where upper(code) = upper(trim(p_promo)) and is_active;
    if not found then raise exception 'Invalid promo code.'; end if;
  end if;

  cur := pr.price * p_qty * (100 - pct) / 100;
  if pr.currency = 'DZD' then total := ceil(cur); dzd := total; usd := ceil(total / rate * 100) / 100;
  else total := round(cur, 2); usd := total; dzd := ceil(total * rate); end if;

  insert into public.orders (user_id, user_email, product_id, product_title, amount_dzd, amount_usd, amount, currency, unit_price, qty,
                             discount_code, discount_pct, method, reference)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), pr.id, pr.title, dzd::integer, usd, total, pr.currency, pr.price, p_qty,
          v_code, pct, p_method, 'RS-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)))
  returning * into o;
  return o;
end $$;
grant execute on function public.create_order(uuid, text, integer, text) to authenticated;

-- 7) Paying an order: takes the ordered quantity out of stock and hands out that many codes
create or replace function public.settle_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; q int;
begin
  update public.orders set status = 'paid', paid_at = now()
  where id = p_order and status in ('pending','awaiting_review','expired')
  returning product_id, qty into pid, q;
  if pid is null then return; end if;
  update public.products set stock = greatest(stock - q, 0), is_sold = (stock - q <= 0) where id = pid;
  update public.product_codes set order_id = p_order
  where id in (select id from public.product_codes where product_id = pid and order_id is null order by created_at limit q for update skip locked);
end $$;

-- 8) What the buyer receives: their own codes (one per line), or the shared content
create or replace function public.get_delivery(p_order uuid)
returns text language sql security definer set search_path = public stable as $$
  select coalesce(
    (select string_agg(c.content, E'\n' order by c.created_at) from public.product_codes c join public.orders o on o.id = c.order_id
      where o.id = p_order and o.user_id = auth.uid() and o.status = 'paid'),
    (select s.content from public.product_secrets s join public.orders o on o.product_id = s.product_id
      where o.id = p_order and o.user_id = auth.uid() and o.status = 'paid')
  );
$$;

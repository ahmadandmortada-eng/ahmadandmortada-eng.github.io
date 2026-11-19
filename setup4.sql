-- =====================================================================
-- Stock per product (run once, after setup2.sql and setup3.sql)
-- =====================================================================

-- 1) Stock: how many units can still be sold
alter table public.products add column if not exists stock integer not null default 1 check (stock >= 0);
update public.products set stock = case when is_sold then 0 else 1 end;

-- many buyers can now hold the same product, so the "one open order" rule goes away
drop index if exists public.one_open_order_per_product;

-- 2) Separate codes (one code per buyer, e.g. gift card codes)
create table public.product_codes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  content text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.product_codes (product_id) where order_id is null;
alter table public.product_codes enable row level security;
create policy "admin only codes" on public.product_codes for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.product_codes to authenticated;
grant all on public.product_codes to service_role;

create or replace function public.admin_add_codes(p_product uuid, p_codes text[])
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  insert into public.product_codes (product_id, content)
    select p_product, trim(c) from unnest(p_codes) c where trim(c) <> '';
  get diagnostics n = row_count;
  update public.products set stock = stock + n, is_sold = false where id = p_product;
end $$;
grant execute on function public.admin_add_codes(uuid, text[]) to authenticated;

-- 3) Public list with live availability (stock minus units held by open orders)
create or replace view public.products_public as
select p.id, p.category, p.title, p.description, p.price_dzd, p.image_url, p.details, p.created_at, p.stock,
  greatest(p.stock - (
    select count(*) from public.orders o
    where o.product_id = p.id and (o.status = 'awaiting_review' or (o.status = 'pending' and o.expires_at > now()))
  ), 0)::int as available
from public.products p where p.is_active;
grant select on public.products_public to anon, authenticated;

-- 4) Creating an order: reserves one unit, safe when many people buy at the same time
create or replace function public.create_order(p_product uuid, p_method text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare pr public.products; o public.orders; held int;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_method not in ('baridimob','crypto') then raise exception 'Unknown payment method.'; end if;
  update public.orders set status = 'expired' where status = 'pending' and expires_at < now();

  select * into pr from public.products where id = p_product and is_active for update;   -- locks this product
  if not found or pr.stock <= 0 then raise exception 'This item is sold out.'; end if;

  -- the same buyer keeps their existing open order instead of holding more units
  select * into o from public.orders where product_id = pr.id and user_id = auth.uid() and status in ('pending','awaiting_review') limit 1;
  if found then return o; end if;

  select count(*) into held from public.orders where product_id = pr.id and status in ('pending','awaiting_review');
  if held >= pr.stock then raise exception 'All units are being purchased right now. Try again in a few minutes.'; end if;

  insert into public.orders (user_id, user_email, product_id, product_title, amount_dzd, method, reference)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), pr.id, pr.title, pr.price_dzd, p_method,
          'RS-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)))
  returning * into o;
  return o;
end $$;

-- 5) Paying an order: takes one unit out of stock (once) and hands out one code if the product uses codes
create or replace function public.settle_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; cid uuid;
begin
  update public.orders set status = 'paid', paid_at = now()
  where id = p_order and status in ('pending','awaiting_review','expired')
  returning product_id into pid;
  if pid is null then return; end if;
  update public.products set stock = greatest(stock - 1, 0), is_sold = (stock - 1 <= 0) where id = pid;
  select id into cid from public.product_codes where product_id = pid and order_id is null order by created_at limit 1 for update skip locked;
  if cid is not null then update public.product_codes set order_id = p_order where id = cid; end if;
end $$;

-- 6) What the buyer receives: their own code, or the shared content
create or replace function public.get_delivery(p_order uuid)
returns text language sql security definer set search_path = public stable as $$
  select coalesce(
    (select c.content from public.product_codes c join public.orders o on o.id = c.order_id
      where o.id = p_order and o.user_id = auth.uid() and o.status = 'paid' limit 1),
    (select s.content from public.product_secrets s join public.orders o on o.product_id = s.product_id
      where o.id = p_order and o.user_id = auth.uid() and o.status = 'paid')
  );
$$;

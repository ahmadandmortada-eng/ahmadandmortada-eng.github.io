-- Shows "available" and "sold" counts to customers (run once, after setup4.sql)
-- Only numbers are exposed: no orders, emails or buyer details.
create or replace view public.products_public as
select p.id, p.category, p.title, p.description, p.price_dzd, p.image_url, p.details, p.created_at, p.stock,
  greatest(p.stock - (
    select count(*) from public.orders o
    where o.product_id = p.id and (o.status = 'awaiting_review' or (o.status = 'pending' and o.expires_at > now()))
  ), 0)::int as available,
  (select count(*) from public.orders o where o.product_id = p.id and o.status = 'paid')::int as sold
from public.products p where p.is_active;
grant select on public.products_public to anon, authenticated;

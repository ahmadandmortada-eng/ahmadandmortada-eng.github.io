-- =====================================================================
-- Resemblance shop, part 2: settings, orders, payments (run once, after setup.sql)
-- =====================================================================

-- 1) Settings (RIP, name, exchange rate). Visitors may read them, only admins may change them.
create table public.settings (key text primary key, value text not null default '');
alter table public.settings enable row level security;
create policy "anyone reads settings" on public.settings for select using (true);
create policy "admin writes settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());
insert into public.settings (key, value) values ('rip', ''), ('rip_name', ''), ('dzd_per_usd', '250')
on conflict (key) do nothing;

-- 2) Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  product_id uuid not null references public.products(id) on delete restrict,
  product_title text not null,
  amount_dzd integer not null,
  method text not null check (method in ('baridimob','crypto')),
  status text not null default 'pending' check (status in ('pending','awaiting_review','paid','rejected','expired','cancelled')),
  reference text not null,
  proof_path text, tx_ref text,
  crypto_currency text, pay_address text, pay_amount numeric, provider_payment_id text, provider_status text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz not null default now() + interval '60 minutes'
);
-- an item can only have ONE open order at a time (no double selling)
create unique index one_open_order_per_product on public.orders (product_id) where status in ('pending','awaiting_review');
alter table public.orders enable row level security;
create policy "see own orders (admin sees all)" on public.orders for select using (user_id = auth.uid() or public.is_admin());
-- no insert/update policies: orders are only changed through the functions below

-- 3) Functions
create or replace function public.create_order(p_product uuid, p_method text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare pr public.products; o public.orders;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_method not in ('baridimob','crypto') then raise exception 'Unknown payment method.'; end if;
  update public.orders set status = 'expired' where status = 'pending' and expires_at < now();
  select * into pr from public.products where id = p_product and is_active and not is_sold;
  if not found then raise exception 'This item is no longer available.'; end if;
  begin
    insert into public.orders (user_id, user_email, product_id, product_title, amount_dzd, method, reference)
    values (auth.uid(), (select email from auth.users where id = auth.uid()), pr.id, pr.title, pr.price_dzd, p_method,
            'RS-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)))
    returning * into o;
  exception when unique_violation then
    raise exception 'Someone else is buying this item right now. Try again in a few minutes.';
  end;
  return o;
end $$;

create or replace function public.submit_proof(p_order uuid, p_path text, p_tx text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'awaiting_review', proof_path = p_path, tx_ref = nullif(trim(p_tx), ''),
         expires_at = now() + interval '3 days'
  where id = p_order and user_id = auth.uid() and method = 'baridimob' and status = 'pending';
  if not found then raise exception 'Order cannot accept a receipt.'; end if;
end $$;

-- marks an order paid + the item sold (used by admin approval and by the crypto webhook)
create or replace function public.settle_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'paid', paid_at = now()
  where id = p_order and status in ('pending','awaiting_review','expired');
  update public.products set is_sold = true where id = (select product_id from public.orders where id = p_order and status = 'paid');
end $$;
revoke all on function public.settle_order(uuid) from public, anon, authenticated;
grant execute on function public.settle_order(uuid) to service_role;

create or replace function public.admin_set_order(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  if p_status = 'paid' then perform public.settle_order(p_order);
  elsif p_status = 'rejected' then update public.orders set status = 'rejected' where id = p_order and status <> 'paid';
  else raise exception 'Bad status.'; end if;
end $$;

-- the buyer gets the hidden delivery content ONLY for their own paid orders
create or replace function public.get_delivery(p_order uuid)
returns text language sql security definer set search_path = public stable as $$
  select s.content from public.product_secrets s join public.orders o on o.product_id = s.product_id
  where o.id = p_order and o.user_id = auth.uid() and o.status = 'paid';
$$;

-- 4) Permissions
grant select on public.settings to anon, authenticated;
grant insert, update, delete on public.settings to authenticated;
grant select on public.orders to authenticated;
grant execute on function public.create_order(uuid, text), public.submit_proof(uuid, text, text),
      public.admin_set_order(uuid, text), public.get_delivery(uuid) to authenticated;

-- 5) Private storage for Baridi Mob receipts
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
create policy "users upload their own receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users and admin read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

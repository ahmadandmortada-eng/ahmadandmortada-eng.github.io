-- Lets a customer delete their own orders (run once, after setup2.sql)

create or replace function public.delete_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if not found then raise exception 'Order not found.'; end if;
  if o.status in ('paid', 'awaiting_review') then
    raise exception 'This order cannot be deleted.';
  end if;
  -- a crypto order with a payment address may still receive money: keep it for 24 hours
  if o.method = 'crypto' and o.provider_payment_id is not null and o.status in ('pending', 'expired')
     and o.created_at > now() - interval '24 hours' then
    raise exception 'This order has a payment address. You can delete it after 24 hours.';
  end if;
  delete from public.orders where id = p_order;
end $$;
grant execute on function public.delete_order(uuid) to authenticated;

-- lets the customer remove their own uploaded receipt image
create policy "users delete their own receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

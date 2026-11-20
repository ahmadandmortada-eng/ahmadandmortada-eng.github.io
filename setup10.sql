-- Adds Discord, Snapchat and Tellonym username products (run once, after setup9.sql)
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (category in (
  'tiktok_username','instagram_username','discord_username','snapchat_username','tellonym_username','gift_card','digital_product'));

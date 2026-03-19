alter table public.invoices
  drop constraint if exists invoices_quote_id_key;

drop index if exists public.invoices_quote_id_key;
drop index if exists public.invoices_quote_id_idx_unique;
drop index if exists public.invoices_user_id_quote_id_key;

create index if not exists invoices_quote_id_idx
  on public.invoices (quote_id);
alter table public.invoices
  add column if not exists delivery_time text,
  add column if not exists discount_type text default 'percent',
  add column if not exists discount_value numeric(12,2) default 0,
  add column if not exists apply_tax boolean default true,
  add column if not exists tax_rate numeric(12,2) default 0;

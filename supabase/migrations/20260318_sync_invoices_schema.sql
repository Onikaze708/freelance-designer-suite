create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as 
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
;

alter table public.invoices
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists invoice_number text,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists client_name text default '',
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists client_snapshot jsonb,
  add column if not exists date date default current_date,
  add column if not exists due_date date,
  add column if not exists status text default 'draft',
  add column if not exists subtotal numeric(12,2) default 0,
  add column if not exists extras numeric(12,2) default 0,
  add column if not exists tax numeric(12,2) default 0,
  add column if not exists discount numeric(12,2) default 0,
  add column if not exists total numeric(12,2) default 0,
  add column if not exists notes text,
  add column if not exists payment_terms text,
  add column if not exists delivery_time text,
  add column if not exists discount_type text default 'percent',
  add column if not exists discount_value numeric(12,2) default 0,
  add column if not exists apply_tax boolean default true,
  add column if not exists tax_rate numeric(12,2) default 0,
  add column if not exists payment_method text,
  add column if not exists paypal_link text,
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.invoices
  alter column items set default '[]'::jsonb,
  alter column subtotal set default 0,
  alter column extras set default 0,
  alter column tax set default 0,
  alter column discount set default 0,
  alter column total set default 0,
  alter column status set default 'draft';

create unique index if not exists invoices_user_id_invoice_number_key
  on public.invoices (user_id, invoice_number);

create index if not exists invoices_user_id_updated_at_idx
  on public.invoices (user_id, updated_at desc);

create index if not exists invoices_quote_id_idx
  on public.invoices (quote_id);

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own"
on public.invoices
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "invoices_insert_own" on public.invoices;
create policy "invoices_insert_own"
on public.invoices
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "invoices_update_own" on public.invoices;
create policy "invoices_update_own"
on public.invoices
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "invoices_delete_own" on public.invoices;
create policy "invoices_delete_own"
on public.invoices
for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();
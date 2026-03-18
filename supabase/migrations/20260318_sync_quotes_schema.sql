create extension if not exists pgcrypto;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid()
);

alter table public.quotes
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists quote_number text,
  add column if not exists client_name text default '',
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists client_snapshot jsonb,
  add column if not exists date date default current_date,
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
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists archived_at timestamptz,
  add column if not exists duplicated_from_id uuid references public.quotes(id) on delete set null,
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

update public.quotes
set client_name = coalesce(client_name, '')
where client_name is null;

update public.quotes
set quote_number = coalesce(quote_number, 'Q-' || extract(year from current_date)::text || '-0000')
where quote_number is null;

update public.quotes
set user_id = auth.uid()
where user_id is null
  and auth.uid() is not null;

alter table public.quotes
  alter column user_id set not null,
  alter column quote_number set not null,
  alter column client_name set not null,
  alter column date set not null,
  alter column status set not null,
  alter column subtotal set not null,
  alter column extras set not null,
  alter column tax set not null,
  alter column discount set not null,
  alter column total set not null,
  alter column discount_type set not null,
  alter column discount_value set not null,
  alter column apply_tax set not null,
  alter column tax_rate set not null,
  alter column items set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

create unique index if not exists quotes_user_id_quote_number_key
  on public.quotes (user_id, quote_number);

create index if not exists quotes_user_id_updated_at_idx
  on public.quotes (user_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
before update on public.quotes
for each row
execute function public.set_updated_at();

alter table public.quotes enable row level security;

drop policy if exists "quotes_select_own" on public.quotes;
create policy "quotes_select_own"
on public.quotes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "quotes_insert_own" on public.quotes;
create policy "quotes_insert_own"
on public.quotes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "quotes_update_own" on public.quotes;
create policy "quotes_update_own"
on public.quotes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "quotes_delete_own" on public.quotes;
create policy "quotes_delete_own"
on public.quotes
for delete
to authenticated
using (user_id = auth.uid());

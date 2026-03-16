create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_number text not null,
  client_name text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  client_snapshot jsonb,
  date date not null default current_date,
  status text not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  extras numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  discount_type text not null default 'percent',
  discount_value numeric(12,2) not null default 0,
  apply_tax boolean not null default true,
  tax_rate numeric(12,2) not null default 0,
  notes text,
  payment_terms text,
  delivery_time text,
  items jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  duplicated_from_id uuid references public.quotes(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists quotes_user_id_quote_number_key
  on public.quotes (user_id, quote_number);

create index if not exists quotes_user_id_updated_at_idx
  on public.quotes (user_id, updated_at desc);

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

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
before update on public.quotes
for each row
execute function public.set_updated_at();

-- ============================================================
-- Shop Bank Tracker - Supabase schema
-- Run this ONCE in the Supabase SQL editor after creating your project.
-- ============================================================

create extension if not exists "pgcrypto";

-- 1. ENUM
create type entry_kind as enum (
  'sales_deposited',
  'telebirr_sales',
  'telebirr_to_cbe',
  'telebirr_to_dashen',
  'dashen_to_telebirr',
  'cbe_to_telebirr',
  'paid_supplier'
);

-- 2. accounts
create table accounts (
  id                serial primary key,
  name              text not null unique,
  opening_balance   numeric(14,2) not null default 0,
  statement_balance numeric(14,2) not null default 0
);

insert into accounts (name, opening_balance, statement_balance) values
  ('Dashen Bank', 0, 0),
  ('CBE',         0, 0),
  ('Telebirr',    0, 0);

-- 3. entries
create table entries (
  id           uuid primary key default gen_random_uuid(),
  entry_date   date not null default current_date,
  kind         entry_kind not null,
  amount       numeric(14,2) not null check (amount > 0),
  paid_from    integer references accounts(id),
  note         text,
  receipt_path text,
  created_by   uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint paid_supplier_needs_account
    check (kind <> 'paid_supplier' or paid_from is not null)
);

-- 4. account_moves view
create or replace view account_moves with (security_invoker = true) as
select e.id as entry_id, a.id as account_id, e.amount as delta
  from entries e join accounts a on a.name = 'Dashen Bank' where e.kind = 'sales_deposited'
union all
select e.id, a.id, e.amount
  from entries e join accounts a on a.name = 'Telebirr' where e.kind = 'telebirr_sales'
union all
select e.id, a.id, -e.amount
  from entries e join accounts a on a.name = 'Telebirr' where e.kind = 'telebirr_to_cbe'
union all
select e.id, a.id, e.amount
  from entries e join accounts a on a.name = 'CBE' where e.kind = 'telebirr_to_cbe'
union all
select e.id, a.id, -e.amount
  from entries e join accounts a on a.name = 'Telebirr' where e.kind = 'telebirr_to_dashen'
union all
select e.id, a.id, e.amount
  from entries e join accounts a on a.name = 'Dashen Bank' where e.kind = 'telebirr_to_dashen'
union all
select e.id, a.id, -e.amount
  from entries e join accounts a on a.name = 'Dashen Bank' where e.kind = 'dashen_to_telebirr'
union all
select e.id, a.id, e.amount
  from entries e join accounts a on a.name = 'Telebirr' where e.kind = 'dashen_to_telebirr'
union all
select e.id, a.id, -e.amount
  from entries e join accounts a on a.name = 'CBE' where e.kind = 'cbe_to_telebirr'
union all
select e.id, a.id, e.amount
  from entries e join accounts a on a.name = 'Telebirr' where e.kind = 'cbe_to_telebirr'
union all
select e.id, e.paid_from, -e.amount
  from entries e where e.kind = 'paid_supplier';

-- 5. account_balances view
create or replace view account_balances with (security_invoker = true) as
select
  a.id,
  a.name,
  a.opening_balance                                                    as opening,
  coalesce(sum(m.delta) filter (where m.delta > 0), 0)                as money_in,
  coalesce(abs(sum(m.delta) filter (where m.delta < 0)), 0)           as money_out,
  a.opening_balance + coalesce(sum(m.delta), 0)                       as balance,
  a.statement_balance
from accounts a
left join account_moves m on m.account_id = a.id
group by a.id, a.name, a.opening_balance, a.statement_balance;

-- 6. Row Level Security
alter table accounts enable row level security;
alter table entries  enable row level security;

create policy "accounts_select" on accounts for select to authenticated using (true);
create policy "accounts_update" on accounts for update to authenticated using (true) with check (true);
create policy "entries_select"  on entries  for select to authenticated using (true);
create policy "entries_insert"  on entries  for insert to authenticated with check (auth.uid() is not null);
create policy "entries_delete"  on entries  for delete to authenticated using (true);

-- 7. Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts');

create policy "receipts_select" on storage.objects
  for select to authenticated using (bucket_id = 'receipts');

create policy "receipts_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts');
-- ============================================================
-- Shop Bank Tracker - Supabase schema
-- Safe to run multiple times (drops and recreates everything).
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- Clean up previous runs (order matters: views first, then tables, then type)
-- ============================================================
drop view  if exists public.account_balances cascade;
drop view  if exists public.account_moves    cascade;
drop table if exists public.entries          cascade;
drop table if exists public.accounts         cascade;
drop type  if exists entry_kind              cascade;

-- ============================================================
-- 1. ENUM
-- ============================================================
create type entry_kind as enum (
  'sales_deposited',
  'sales_deposited_cbe',
  'telebirr_sales',
  'telebirr_to_cbe',
  'telebirr_to_dashen',
  'dashen_to_telebirr',
  'cbe_to_telebirr',
  'paid_supplier'
);

-- ============================================================
-- 2. accounts
-- ============================================================
create table public.accounts (
  id                serial          primary key,
  name              text            not null unique,
  opening_balance   numeric(14,2)   not null default 0,
  statement_balance numeric(14,2)   not null default 0
);

-- Seed the three fixed accounts
insert into public.accounts (name, opening_balance, statement_balance) values
  ('Dashen Bank', 0, 0),
  ('CBE',         0, 0),
  ('Telebirr',    0, 0);

-- ============================================================
-- 3. entries
-- ============================================================
create table public.entries (
  id           uuid          primary key default gen_random_uuid(),
  entry_date   date          not null default current_date,
  kind         entry_kind    not null,
  amount       numeric(14,2) not null check (amount > 0),
  paid_from    integer       references public.accounts(id),
  note         text,
  receipt_path text,
  created_by   uuid          references auth.users(id) default auth.uid(),
  created_at   timestamptz   not null default now(),
  constraint paid_supplier_needs_account
    check (kind <> 'paid_supplier' or paid_from is not null)
);

-- ============================================================
-- 4. View: account_moves
--    Turns each entry into +/- delta rows per account touched.
--    security_invoker = true means the view respects RLS.
-- ============================================================
create or replace view public.account_moves
  with (security_invoker = true)
as
  -- sales_deposited -> Dashen +amount
  select e.id as entry_id, a.id as account_id, e.amount as delta
  from public.entries  e
  join public.accounts a on a.name = 'Dashen Bank'
  where e.kind = 'sales_deposited'

  union all

  -- sales_deposited_cbe -> CBE +amount
  select e.id, a.id, e.amount
  from public.entries  e
  join public.accounts a on a.name = 'CBE'
  where e.kind = 'sales_deposited_cbe'

  union all

  -- telebirr_sales -> Telebirr +amount
  select e.id, a.id, e.amount
  from public.entries  e
  join public.accounts a on a.name = 'Telebirr'
  where e.kind = 'telebirr_sales'

  union all

  -- telebirr_to_cbe -> Telebirr -amount
  select e.id, a.id, -e.amount
  from public.entries  e
  join public.accounts a on a.name = 'Telebirr'
  where e.kind = 'telebirr_to_cbe'

  union all

  -- telebirr_to_cbe -> CBE +amount
  select e.id, a.id, e.amount
  from public.entries  e
  join public.accounts a on a.name = 'CBE'
  where e.kind = 'telebirr_to_cbe'

  union all

  -- telebirr_to_dashen -> Telebirr -amount
  select e.id, a.id, -e.amount
  from public.entries  e
  join public.accounts a on a.name = 'Telebirr'
  where e.kind = 'telebirr_to_dashen'

  union all

  -- telebirr_to_dashen -> Dashen +amount
  select e.id, a.id, e.amount
  from public.entries  e
  join public.accounts a on a.name = 'Dashen Bank'
  where e.kind = 'telebirr_to_dashen'

  union all

  -- dashen_to_telebirr -> Dashen -amount
  select e.id, a.id, -e.amount
  from public.entries  e
  join public.accounts a on a.name = 'Dashen Bank'
  where e.kind = 'dashen_to_telebirr'

  union all

  -- dashen_to_telebirr -> Telebirr +amount
  select e.id, a.id, e.amount
  from public.entries  e
  join public.accounts a on a.name = 'Telebirr'
  where e.kind = 'dashen_to_telebirr'

  union all

  -- cbe_to_telebirr -> CBE -amount
  select e.id, a.id, -e.amount
  from public.entries  e
  join public.accounts a on a.name = 'CBE'
  where e.kind = 'cbe_to_telebirr'

  union all

  -- cbe_to_telebirr -> Telebirr +amount
  select e.id, a.id, e.amount
  from public.entries  e
  join public.accounts a on a.name = 'Telebirr'
  where e.kind = 'cbe_to_telebirr'

  union all

  -- paid_supplier -> paid_from account -amount
  select e.id, e.paid_from as account_id, -e.amount
  from public.entries e
  where e.kind = 'paid_supplier';

-- ============================================================
-- 5. View: account_balances
-- ============================================================
create or replace view public.account_balances
  with (security_invoker = true)
as
select
  a.id,
  a.name,
  a.opening_balance                                               as opening,
  coalesce(sum(m.delta) filter (where m.delta > 0), 0)           as money_in,
  coalesce(abs(sum(m.delta) filter (where m.delta < 0)), 0)      as money_out,
  a.opening_balance + coalesce(sum(m.delta), 0)                  as balance,
  a.statement_balance
from public.accounts a
left join public.account_moves m on m.account_id = a.id
group by a.id, a.name, a.opening_balance, a.statement_balance;

-- ============================================================
-- 6. Row Level Security
-- ============================================================
alter table public.accounts enable row level security;
alter table public.entries  enable row level security;

create policy "accounts_select"
  on public.accounts for select
  to authenticated
  using (true);

create policy "accounts_update"
  on public.accounts for update
  to authenticated
  using (true)
  with check (true);

create policy "entries_select"
  on public.entries for select
  to authenticated
  using (true);

create policy "entries_insert"
  on public.entries for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "entries_update"
  on public.entries for update
  to authenticated
  using (true)
  with check (true);

create policy "entries_delete"
  on public.entries for delete
  to authenticated
  using (true);

-- ============================================================
-- 7. Storage bucket "receipts" (private)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Drop storage policies if they exist (safe to re-run)
do $$ begin
  drop policy if exists "receipts_upload" on storage.objects;
  drop policy if exists "receipts_select" on storage.objects;
  drop policy if exists "receipts_delete" on storage.objects;
exception when others then null;
end $$;

create policy "receipts_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts');

create policy "receipts_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts');

create policy "receipts_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'receipts');
# 🏦 Shop Bank Tracker

A mobile-friendly web app for a small shop in Ethiopia to track Dashen Bank, CBE, and Telebirr account balances in **Ethiopian Birr (Br)**.

Built with **Next.js 16 (App Router, TypeScript)** + **Supabase (Postgres, Auth, Storage)** — deployable on **Vercel** in minutes.

---

## Features

- **3 fixed accounts** — Dashen Bank, CBE, Telebirr
- **7 transaction types** with automatic double-entry bookkeeping (transfers move money between two accounts in one entry)
- **Balances table** — opening, money in/out, computed balance, real bank balance (editable), difference, BALANCED / ⚠ CHECK status
- **Receipt management** — attach photo or PDF per entry, camera capture on phone, MISSING badge with one-tap add-later
- **Month picker** — browse any past month
- **Supplier summary** — total paid per supplier this month
- **Filters** — by account and by supplier name
- **CSV export** — one tap to download the month's entries
- **Secure** — email + password login only, RLS on all tables, private storage bucket, signed URLs for receipts

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Note your **Project URL** and **anon/public key** from  
   `Settings → API`

### 2. Run the database schema

1. In the Supabase dashboard, go to **SQL Editor**
2. Paste the entire contents of [`schema.sql`](./schema.sql) and click **Run**

This creates:
- `entry_kind` enum
- `accounts` table (pre-seeded with Dashen Bank, CBE, Telebirr)
- `entries` table with constraints
- `account_moves` view (security_invoker)
- `account_balances` view (security_invoker)
- Row Level Security policies
- `receipts` private storage bucket + policies

### 3. Create a user

In the Supabase dashboard → **Authentication → Users → Add user**  
(Email + password. No public sign-up is enabled.)

### 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ Never use the **service role key** here. Only the anon key goes in the frontend.

### 5. Install and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## Deploy on Vercel

1. Push this repo to GitHub / GitLab
2. Import it in [vercel.com](https://vercel.com) → **New Project**
3. Add the two environment variables in Vercel's project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy** — done!

---

## Entry Types

| What happened | Accounts affected |
|---|---|
| Sales deposited to Dashen | Dashen Bank **+amount** |
| Telebirr sales received | Telebirr **+amount** |
| Telebirr → CBE | Telebirr **−amount**, CBE **+amount** |
| Telebirr → Dashen | Telebirr **−amount**, Dashen **+amount** |
| Dashen → Telebirr | Dashen **−amount**, Telebirr **+amount** |
| CBE → Telebirr | CBE **−amount**, Telebirr **+amount** |
| Paid supplier | Chosen account **−amount** |

Transfers are a **single entry** that moves money between two accounts — never enter the same transfer twice.

---

## Database Schema Overview

```
accounts          entries            account_moves (view)
─────────         ───────            ────────────────────
id                id (uuid PK)       entry_id
name (unique)     entry_date         account_id
opening_balance   kind (enum)        delta (+/-)
statement_balance amount
                  paid_from → accounts
                  note
                  receipt_path
                  created_by → auth.users
                  created_at

account_balances (view)
───────────────────────
id, name, opening, money_in, money_out, balance, statement_balance
```

---

## Project Structure

```
src/
  app/
    layout.tsx          Root layout (Inter font, viewport)
    page.tsx            Main page (server component, fetches initial data)
    globals.css
    login/page.tsx      Login page
    api/
      receipt/route.ts  POST – upload receipt to Supabase Storage
      signed-url/route.ts GET – create signed URL for private receipt
  components/
    Dashboard.tsx       Main client component (tabs: Balances / New Entry / Entries)
    BalancesTable.tsx   Inline-editable balances table
    EntryForm.tsx       New entry form with file upload
    EntriesList.tsx     Month entries, filters, CSV export
  lib/
    supabase-client.ts  Browser Supabase client
    supabase-server.ts  Server-side Supabase client (SSR)
    utils.ts            Formatting helpers
  types/index.ts        TypeScript types
  proxy.ts              Auth guard (Next.js proxy – replaces middleware)
schema.sql              Run once in Supabase SQL editor
```

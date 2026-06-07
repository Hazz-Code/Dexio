# StickerVault

A multiplayer digital sticker collecting & trading web app, inspired by Quidd.

## Stack
- React + Vite (frontend)
- Supabase (auth, database, real-time)
- Vercel (hosting)

## Setup

### 1. Supabase — run this SQL once in your Supabase SQL Editor

```sql
create or replace function exec_sql(sql text) returns void
language plpgsql security definer as $$
begin execute sql; end; $$;

create table if not exists sv_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  coins int not null default 150,
  created_at timestamptz default now()
);
alter table sv_profiles enable row level security;
create policy "profiles_select" on sv_profiles for select using (true);
create policy "profiles_insert" on sv_profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on sv_profiles for update using (auth.uid() = id);

create table if not exists sv_collection (
  id serial primary key,
  user_id uuid references sv_profiles(id) on delete cascade,
  sticker_id int not null,
  for_trade boolean default false,
  created_at timestamptz default now(),
  unique(user_id, sticker_id)
);
alter table sv_collection enable row level security;
create policy "col_select" on sv_collection for select using (true);
create policy "col_insert" on sv_collection for insert with check (auth.uid() = user_id);
create policy "col_update" on sv_collection for update using (auth.uid() = user_id);
create policy "col_delete" on sv_collection for delete using (auth.uid() = user_id);

create table if not exists sv_trades (
  id serial primary key,
  from_user uuid references sv_profiles(id) on delete cascade,
  to_user uuid references sv_profiles(id) on delete cascade,
  offer_sticker_id int not null,
  want_sticker_id int not null,
  status text default 'pending',
  created_at timestamptz default now()
);
alter table sv_trades enable row level security;
create policy "trades_select" on sv_trades for select using (true);
create policy "trades_insert" on sv_trades for insert with check (auth.uid() = from_user);
create policy "trades_update" on sv_trades for update using (auth.uid() = to_user or auth.uid() = from_user);
```

### 2. Run locally
```bash
npm install
npm run dev
```

### 3. Deploy to Vercel
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import repo
3. Hit Deploy — no config needed!

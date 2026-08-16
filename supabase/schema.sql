create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expense_type text not null default 'Fixkosten',
  payment_interval text not null default 'monatlich',
  next_payment_date date,
  payment_method text,
  provider text,
  contract_number text,
  cancellation_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_interval text not null default 'monatlich',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;

create policy "categories_select_own" on public.categories for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories for update using (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories for delete using (auth.uid() = user_id);

create policy "expenses_select_own" on public.expenses for select using (auth.uid() = user_id);
create policy "expenses_insert_own" on public.expenses for insert with check (auth.uid() = user_id);
create policy "expenses_update_own" on public.expenses for update using (auth.uid() = user_id);
create policy "expenses_delete_own" on public.expenses for delete using (auth.uid() = user_id);

create policy "incomes_select_own" on public.incomes for select using (auth.uid() = user_id);
create policy "incomes_insert_own" on public.incomes for insert with check (auth.uid() = user_id);
create policy "incomes_update_own" on public.incomes for update using (auth.uid() = user_id);
create policy "incomes_delete_own" on public.incomes for delete using (auth.uid() = user_id);

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_category_id_idx on public.expenses(category_id);
create index if not exists incomes_user_id_idx on public.incomes(user_id);

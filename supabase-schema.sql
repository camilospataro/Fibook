-- FinanceOS Supabase Schema
-- Run this in your Supabase SQL Editor to create all required tables.

-- Settings
create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  exchange_rate numeric not null default 4000,
  exchange_rate_updated_at timestamptz,
  savings_target numeric not null default 0,
  created_at timestamptz default now()
);
alter table settings enable row level security;
create policy "Users can manage own settings" on settings for all using (auth.uid() = user_id);

-- Debt Accounts
create table debt_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  currency text not null default 'COP' check (currency in ('COP', 'USD')),
  current_balance numeric not null default 0,
  minimum_monthly_payment numeric not null default 0,
  monthly_payment numeric not null default 0,
  color text not null default '#FF6B6B',
  created_at timestamptz default now()
);
alter table debt_accounts enable row level security;
create policy "Users can manage own debt accounts" on debt_accounts for all using (auth.uid() = user_id);

-- Income Sources
create table income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric not null default 0,
  currency text not null default 'COP' check (currency in ('COP', 'USD')),
  is_recurring boolean not null default true,
  created_at timestamptz default now()
);
alter table income_sources enable row level security;
create policy "Users can manage own income sources" on income_sources for all using (auth.uid() = user_id);

-- Fixed Expenses
create table fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric not null default 0,
  currency text not null default 'COP' check (currency in ('COP', 'USD')),
  category text not null default 'other' check (category in ('housing', 'food', 'transport', 'entertainment', 'health', 'other')),
  created_at timestamptz default now()
);
alter table fixed_expenses enable row level security;
create policy "Users can manage own fixed expenses" on fixed_expenses for all using (auth.uid() = user_id);

-- Subscriptions
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  currency text not null default 'COP' check (currency in ('COP', 'USD')),
  amount numeric not null default 0,
  "group" text not null default 'General',
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "Users can manage own subscriptions" on subscriptions for all using (auth.uid() = user_id);

-- Spending
create table spending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  description text not null,
  amount numeric not null default 0,
  category text not null default 'other' check (category in ('groceries', 'transport', 'food', 'entertainment', 'health', 'shopping', 'other')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'debit', 'credit_mastercard_cop', 'credit_mastercard_usd', 'credit_visa')),
  created_at timestamptz default now()
);
alter table spending enable row level security;
create policy "Users can manage own spending" on spending for all using (auth.uid() = user_id);

-- Monthly Snapshots
create table monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month text not null,
  debt_balances jsonb not null default '[]',
  income_entries jsonb not null default '[]',
  side_income numeric not null default 0,
  total_income numeric not null default 0,
  total_expenses numeric not null default 0,
  total_debt_paid numeric not null default 0,
  new_charges numeric not null default 0,
  balance numeric not null default 0,
  cash_on_hand numeric not null default 0,
  savings numeric not null default 0,
  created_at timestamptz default now(),
  unique(user_id, month)
);
alter table monthly_snapshots enable row level security;
create policy "Users can manage own snapshots" on monthly_snapshots for all using (auth.uid() = user_id);

# 💰 Personal Financial Tracker App — Full Vibe Coding Prompt

## PROJECT OVERVIEW

Build a full-stack personal finance tracking web app called **"FinanceOS"** (or similar sleek name). This app is a digital version of a personal Colombian-peso-based financial workbook. The user tracks monthly debt, income, and expenses across multiple credit cards and income sources, logs daily spending, and wants projections on debt payoff and savings growth.

All monetary values are in **Colombian Pesos (COP)** by default, but the app must support a **USD/COP exchange rate** setting because some debts and subscriptions are in USD.

---

## TECH STACK

- **Frontend**: React + TypeScript (Vite)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand (for local UI state / optimistic updates)
- **Backend / Database**: Supabase (Postgres + Realtime + Auth)
- **Authentication**: Supabase Auth — email/password login (single user app, but auth protects the data)
- **ORM / DB Client**: Supabase JS client (`@supabase/supabase-js`)
- **Charts**: Recharts
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Fonts**: Use Google Fonts — pair a strong display font (e.g., `Syne`, `DM Serif Display`, or `Space Grotesk`) with a clean body font (e.g., `DM Sans` or `Outfit`)
- **Deployment**: Vercel (frontend hosting + CI/CD via GitHub integration)
- **Version Control**: GitHub (main branch auto-deploys to Vercel)
- **Mobile (future)**: The app must be built PWA-ready AND structured so it can be wrapped with **Capacitor** later to export as an Android APK — use standard web APIs only, no Node-specific dependencies, and avoid any libraries that break in a WebView context

---

## DESIGN AESTHETIC

Go for a **dark, premium financial dashboard** feel — like a fintech app. Think deep navy or near-black backgrounds (`#0A0F1E` or similar), electric accent colors (teal `#00D4AA` or electric blue `#4F8EF7`), subtle glassmorphism cards with soft glows, and sharp typography. Numbers should feel important — large, bold, monospace where relevant. Use subtle animated number counters on the dashboard. The vibe is: *Bloomberg terminal meets modern fintech startup*.

---

## DATA MODEL & SUPABASE SCHEMA

All data is stored in **Supabase (Postgres)**. Every table includes a `user_id uuid` column (foreign key to `auth.users`) so all queries are scoped to the authenticated user. Enable **Row Level Security (RLS)** on every table with a policy: `auth.uid() = user_id`.

### Supabase Environment Variables (add to Vercel + `.env.local`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Client Setup (`src/lib/supabase.ts`)
```ts
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### SQL Migration (run in Supabase SQL editor)

```sql
-- Settings (one row per user)
create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  exchange_rate numeric not null default 4000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table settings enable row level security;
create policy "user owns settings" on settings using (auth.uid() = user_id);

-- Debt Accounts
create table debt_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  currency text check (currency in ('COP','USD')) not null default 'COP',
  current_balance numeric not null default 0,
  minimum_monthly_payment numeric not null default 0,
  color text default '#4F8EF7',
  created_at timestamptz default now()
);
alter table debt_accounts enable row level security;
create policy "user owns debt_accounts" on debt_accounts using (auth.uid() = user_id);

-- Income Sources
create table income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  amount numeric not null default 0,
  is_recurring boolean not null default true,
  created_at timestamptz default now()
);
alter table income_sources enable row level security;
create policy "user owns income_sources" on income_sources using (auth.uid() = user_id);

-- Fixed Expenses
create table fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  amount numeric not null default 0,
  category text check (category in ('housing','food','transport','entertainment','health','other')) not null default 'other',
  created_at timestamptz default now()
);
alter table fixed_expenses enable row level security;
create policy "user owns fixed_expenses" on fixed_expenses using (auth.uid() = user_id);

-- Subscriptions
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  currency text check (currency in ('COP','USD')) not null default 'COP',
  amount numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "user owns subscriptions" on subscriptions using (auth.uid() = user_id);

-- Spending Entries
create table spending_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null default current_date,
  description text not null,
  amount numeric not null,
  category text check (category in ('groceries','transport','food','entertainment','health','shopping','other')) not null default 'other',
  payment_method text check (payment_method in ('cash','debit','credit_mastercard_cop','credit_mastercard_usd','credit_visa')) not null default 'cash',
  created_at timestamptz default now()
);
alter table spending_entries enable row level security;
create policy "user owns spending_entries" on spending_entries using (auth.uid() = user_id);

-- Monthly Snapshots
create table monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  month text not null,              -- "YYYY-MM"
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
create policy "user owns monthly_snapshots" on monthly_snapshots using (auth.uid() = user_id);
```

### TypeScript Types (`src/types/index.ts`)

```ts
export interface Settings {
  id: string;
  userId: string;
  exchangeRate: number;
}

export interface DebtAccount {
  id: string;
  userId: string;
  name: string;
  currency: 'COP' | 'USD';
  currentBalance: number;
  minimumMonthlyPayment: number;
  color: string;
}

export interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  amount: number;
  isRecurring: boolean;
}

export interface FixedExpense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  category: 'housing' | 'food' | 'transport' | 'entertainment' | 'health' | 'other';
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  currency: 'COP' | 'USD';
  amount: number;
  active: boolean;
}

export interface SpendingEntry {
  id: string;
  userId: string;
  date: string;
  description: string;
  amount: number;
  category: 'groceries' | 'transport' | 'food' | 'entertainment' | 'health' | 'shopping' | 'other';
  paymentMethod: 'cash' | 'debit' | 'credit_mastercard_cop' | 'credit_mastercard_usd' | 'credit_visa';
}

export interface MonthlySnapshot {
  id: string;
  userId: string;
  month: string;
  debtBalances: { accountId: string; balance: number }[];
  incomeEntries: { sourceId: string; amount: number }[];
  sideIncome: number;
  totalIncome: number;
  totalExpenses: number;
  totalDebtPaid: number;
  newCharges: number;
  balance: number;
  cashOnHand: number;
  savings: number;
}
```

---

## APP STRUCTURE — PAGES & ROUTES

### 1. `/` — Dashboard (Home)
**The command center. Everything at a glance.**

Layout: Full-width dark dashboard with a top stats bar and modular cards below.

**Top KPI Bar** (4 large stat cards in a row):
- 💰 **Total Monthly Income** — sum of all income sources this month
- 📉 **Total Debt** — sum of all credit card balances converted to COP
- 📊 **Remaining Balance** — income minus all expenses this month
- 🏦 **Cash on Hand** — cumulative running balance

**Main Content Grid:**

- **Debt Overview Card**: Stacked bar or donut chart showing each debt account's balance. Include % of total, balance in COP, and a mini "months to payoff" badge based on current payment rate.
- **Monthly Income vs Expenses Chart**: Bar chart (Recharts) comparing income vs. expenses for the last 6 months. Use the monthly snapshots.
- **This Month's Spending**: A live list of the last 5 spending entries with category icons and amounts. "+ Add Spending" button prominent.
- **Subscriptions Summary Card**: Total monthly subscriptions cost, list of active subscriptions with toggle to pause.
- **Savings Progress Card**: If user has a savings goal set, show a progress bar. Otherwise show cumulative cash on hand trend line.
- **Quick Projection Badge**: Small card that says "At current rate: Debt-free in X months" and "Savings in 6 months: $X". Clickable to go to /projections.

---

### 2. `/spending` — Spending Log

**A complete log of all daily transactions.**

**Top section**: 
- Big "+ Add Spending" button that opens a slide-in drawer/modal
- Month/date filter
- Category filter chips (All, Groceries, Transport, Food, etc.)
- Total spent this month (large number, updates live)

**Add Spending Drawer** (slide-in from right):
Fields:
  - Description (text input with autocomplete from past entries)
  - Amount (number, COP)
  - Category (icon-based selector grid — tap to pick)
  - Payment Method (dropdown: Cash, Debit, Mastercard COP, Mastercard USD, Visa)
  - Date (defaults to today, editable)
  - Save button

**Spending Table/List**:
Each entry shows: date, description, category icon + label, payment method, amount. Swipe-to-delete or delete button on hover.

**Spending by Category Chart**: Donut chart at top of page showing % breakdown by category for the current month.

**Note**: When a spending entry is saved with a credit card payment method, it should add to that credit card's `newCharges` for the current month.

---

### 3. `/monthly` — Monthly Update

**Update your financial situation at the start of each new month.**

This is the "close the month / open new month" screen.

**Section A — Update Debt Balances**:
For each debt account, show current balance and an input to enter the new actual balance (in native currency). Include a helper showing "Last month: X | Change: ±Y".

**Section B — Update Income**:
For each income source, show current amount with ability to override for this specific month. Plus a "Side Income" field for any irregular income this month.

**Section C — New Credit Card Charges**:
Show total new charges logged via spending entries for each card, auto-populated. Allow manual override if user forgot to log something.

**Section D — CC Payment Applied**:
Show minimum payment per card, allow user to enter actual payment made this month.

**Section E — Confirm & Save Month**:
Big "Save Month Snapshot" button that:
1. Saves a `MonthlySnapshot` object with all the data
2. Updates each debt account's `currentBalance` to the new value
3. Shows a summary modal: "Month closed ✓ — Here's your recap"

---

### 4. `/projections` — Projections & What-If Scenarios

**The "what-if" calculator. Forward-looking financial modeling.**

**Section A — Debt Payoff Projections**:

For each debt account, show:
- Current balance
- Current monthly payment
- **Months to debt-free** (calculated: balance / monthly payment, accounting for no new charges)
- **Projected payoff date** (calendar month)
- Slider to adjust monthly payment → see how months change in real-time
- Mini timeline chart showing balance going to 0 over time

Global "Debt-Free Date" card at top: shows the latest payoff date across all cards, or combined if paying all at same time.

**Section B — Savings Projections**:

Form fields:
- Monthly savings amount (editable, defaults to current month's remaining balance)
- Start month (defaults to current)
- Target month (date picker)

Output:
- **Projected savings at target month** (big number)
- **Line chart** showing savings growth month by month
- Toggle: show with/without interest (optional simple interest rate input)

**Section C — Scenario Comparison**:

Side-by-side compare two scenarios:
- Scenario A (current): pay X/month on debt, save Y/month
- Scenario B (aggressive): pay X+extra/month on debt, save Y-extra/month

Show: months to debt-free, total interest paid (rough estimate), savings at 12 months for each. Use a comparison table/card layout.

---

### 5. `/settings` — Settings & Configuration

**Manage all base assumptions.**

**Exchange Rate**: Input field for USD → COP rate. Shows impact: "Your USD debts total $X USD = $Y COP at this rate."

**Debt Accounts**: 
- List all cards with current balance, currency, minimum payment
- Edit / Delete / Add new button
- Each row: name, currency selector, balance input, min payment input

**Income Sources**:
- List all sources (Salary, Salary #2, Side Income, etc.)
- Edit amounts, add/remove sources

**Fixed Expenses**:
- List: Rent, Groceries + Gas, Extras
- Edit amounts per category

**Subscriptions**:
- Full list: Name | Currency | Amount | Monthly COP Equivalent | Active toggle
- Add new subscription
- Shows "Total subscriptions: X COP/month"

**Data Management**:
- Export all data as JSON
- Import data from JSON
- Reset all data (with confirmation)

---

## INITIAL SEED DATA

When a **new user signs up** (first login, no data exists for their `user_id`), automatically seed their account with these defaults by inserting the following rows into Supabase (call a `seedUserData(userId)` function after sign-up):

```ts
// src/lib/seedData.ts
export async function seedUserData(userId: string) {
  const { supabase } = await import('./supabase');

  await supabase.from('settings').insert({ user_id: userId, exchange_rate: 4000 });

  await supabase.from('debt_accounts').insert([
    { user_id: userId, name: 'Mastercard COP', currency: 'COP', current_balance: 4400000, minimum_monthly_payment: 400000, color: '#FF6B6B' },
    { user_id: userId, name: 'Mastercard USD', currency: 'USD', current_balance: 3297, minimum_monthly_payment: 400, color: '#4ECDC4' },
    { user_id: userId, name: 'Visa', currency: 'COP', current_balance: 0, minimum_monthly_payment: 0, color: '#45B7D1' },
  ]);

  await supabase.from('income_sources').insert([
    { user_id: userId, name: 'Salary', amount: 10900000, is_recurring: true },
    { user_id: userId, name: 'Salary #2', amount: 8000000, is_recurring: true },
    { user_id: userId, name: 'Side Income', amount: 0, is_recurring: false },
  ]);

  await supabase.from('fixed_expenses').insert([
    { user_id: userId, name: 'Rent', amount: 3400000, category: 'housing' },
    { user_id: userId, name: 'Groceries + Gas', amount: 1500000, category: 'food' },
    { user_id: userId, name: 'Extras', amount: 1300000, category: 'other' },
  ]);

  await supabase.from('subscriptions').insert([
    { user_id: userId, name: 'Crunchyroll', currency: 'USD', amount: 4, active: true },
    { user_id: userId, name: 'Spotify', currency: 'COP', amount: 30500, active: true },
    { user_id: userId, name: 'Netflix', currency: 'COP', amount: 40000, active: true },
    { user_id: userId, name: 'Microsoft Office', currency: 'COP', amount: 46000, active: true },
    { user_id: userId, name: 'HBO', currency: 'COP', amount: 25000, active: true },
    { user_id: userId, name: 'Google One', currency: 'COP', amount: 13000, active: true },
    { user_id: userId, name: 'YouTube', currency: 'COP', amount: 21000, active: true },
    { user_id: userId, name: 'Claude', currency: 'USD', amount: 100, active: true },
    { user_id: userId, name: 'Gym', currency: 'USD', amount: 101, active: true },
  ]);
}
```

---

## KEY BUSINESS LOGIC (implement these formulas exactly)

### Total COP Debt
```ts
function totalDebtCOP(accounts: DebtAccount[], exchangeRate: number): number {
  return accounts.reduce((sum, acc) => {
    const balanceCOP = acc.currency === 'USD' ? acc.currentBalance * exchangeRate : acc.currentBalance;
    return sum + balanceCOP;
  }, 0);
}
```

### Monthly Subscriptions Total (COP)
```ts
function totalSubscriptionsCOP(subs: Subscription[], exchangeRate: number): number {
  return subs
    .filter(s => s.active)
    .reduce((sum, s) => {
      const cost = s.currency === 'USD' ? s.amount * exchangeRate : s.amount;
      return sum + cost;
    }, 0);
}
```

### Total Monthly Expenses
```
Total Expenses = Rent + Groceries+Gas + CC Payments (all cards) + Subscriptions + Extras
```

### Monthly Balance (Remaining)
```
Balance = Total Income - Total Expenses
```

### Cash on Hand (Cumulative)
```
cashOnHand[month] = cashOnHand[month-1] + balance[month]
```

### Debt Payoff Projection (simple, no interest)
```ts
function monthsToPayoff(balance: number, monthlyPayment: number, newChargesPerMonth: number = 0): number {
  if (monthlyPayment <= newChargesPerMonth) return Infinity; // never pays off
  return Math.ceil(balance / (monthlyPayment - newChargesPerMonth));
}
```

### Debt Balance After N Months
```ts
function projectedDebt(balance: number, payment: number, newCharges: number, months: number): number {
  let b = balance;
  for (let i = 0; i < months; i++) {
    b = Math.max(0, b + newCharges - payment);
  }
  return b;
}
```

### Savings Projection
```ts
function projectedSavings(monthlySavings: number, months: number, startingSavings: number = 0): number {
  return startingSavings + (monthlySavings * months);
}
```

---

## UX DETAILS & INTERACTIONS

- **Number formatting**: All COP amounts should display with thousands separators: `$4.400.000` or `$4,400,000`. Use `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`.
- **Animated counters**: On the dashboard KPI cards, numbers should animate/count up when the page loads (use a simple easing counter with `requestAnimationFrame` or a library like `react-countup`).
- **Color coding**: Debt amounts in red/coral. Income in green/teal. Remaining balance in blue if positive, orange/red if negative.
- **Empty states**: When there are no spending entries, show a friendly empty state with an illustration and CTA.
- **Responsive**: Must work on mobile. The dashboard cards should stack on mobile. Navigation should become a bottom tab bar on mobile.
- **Navigation**: Desktop: left sidebar. Mobile: bottom tab bar. Tabs: Dashboard, Spending, Monthly, Projections, Settings.
- **Toast notifications**: Show success toasts when saving spending entries ("✓ $45,000 logged"), saving month snapshots, etc.
- **Confirmation dialogs**: Before deleting anything (spending entry, debt account, subscription), show a confirmation dialog.

---

## NAVIGATION SIDEBAR (Desktop)

Left sidebar with:
- App logo / name "FinanceOS"
- Nav items with icons:
  - 📊 Dashboard
  - 💸 Spending
  - 📅 Monthly Update
  - 🔮 Projections
  - ⚙️ Settings
- Bottom of sidebar: current month label (e.g., "March 2026") and current exchange rate (e.g., "USD = $4,000")

---

## ADDITIONAL FEATURES

1. **Month selector**: On the Dashboard and Monthly pages, allow switching between past months to review historical data from monthly snapshots.

2. **Debt-free countdown**: On the Dashboard, show a "🎯 Debt-Free Countdown" that shows days/months remaining if on track, based on current payment rates.

3. **Category spending alerts**: If spending in a category exceeds a configurable threshold (e.g., Groceries > $1,500,000), show a soft warning badge.

4. **Recurring spending detection**: If user logs the same description 3+ times, offer to mark it as a recurring transaction so it auto-suggests.

5. **Monthly recap modal**: After saving a monthly snapshot, show a beautiful full-screen recap modal with: total spent, biggest expense category, debt reduction progress, net worth change direction.

---

## AUTHENTICATION FLOW

Use **Supabase Auth** with email/password. Since this is a single-user personal app, the auth flow is minimal:

- `/login` — simple centered login/signup form (toggle between Sign In and Sign Up)
- On successful **Sign Up**: call `seedUserData(user.id)` to populate defaults, then redirect to `/`
- On successful **Sign In**: check if user already has settings (to detect first-time seeding), then redirect to `/`
- All other routes are **protected** — redirect to `/login` if no active session
- Use a `<ProtectedRoute>` wrapper component around the app routes
- Store session via Supabase's built-in session persistence (it handles this automatically)
- Add a Sign Out button in the sidebar footer

```ts
// Example auth guard
const { data: { session } } = await supabase.auth.getSession();
if (!session) navigate('/login');
```

---

## DEPLOYMENT — GITHUB + VERCEL

### GitHub Setup
- Initialize repo: `git init`, push to GitHub
- Repo structure should include `README.md` with setup instructions (Supabase env vars, SQL migration steps)
- Use a `.env.local` file locally (never commit to git — add to `.gitignore`)

### Vercel Setup
- Connect GitHub repo to Vercel via dashboard
- Set environment variables in Vercel project settings:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Every push to `main` branch auto-deploys to production

### PWA Config (for future Capacitor APK export)
Add a `vite-plugin-pwa` configuration so the app works as a PWA out of the box:

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'FinanceOS',
    short_name: 'FinanceOS',
    theme_color: '#0A0F1E',
    background_color: '#0A0F1E',
    display: 'standalone',
    icons: [/* 192x192 and 512x512 */]
  }
})
```

> **Note on APK export (Capacitor)**: When ready to export as Android APK, install `@capacitor/core` and `@capacitor/android`, run `npx cap init`, `npx cap add android`, and `npx cap sync`. The Supabase JS client works natively in Capacitor WebView. No code changes needed — the Vite build output drops straight in.

---

## FOLDER STRUCTURE

```
financeos/
├── .env.local                  (never commit — Supabase keys)
├── .gitignore
├── README.md
├── vite.config.ts
├── index.html
├── public/
│   └── icons/                  (PWA icons)
└── src/
    ├── main.tsx
    ├── App.tsx                  (router + auth guard)
    ├── components/
    │   ├── layout/              (Sidebar, BottomNav, PageContainer, ProtectedRoute)
    │   ├── ui/                  (shadcn components)
    │   ├── charts/              (DebtChart, IncomeExpenseChart, SavingsChart)
    │   ├── cards/               (KPICard, DebtAccountCard, SubscriptionCard)
    │   └── modals/              (AddSpendingDrawer, MonthRecapModal, ConfirmDialog)
    ├── pages/
    │   ├── Login.tsx
    │   ├── Dashboard.tsx
    │   ├── Spending.tsx
    │   ├── Monthly.tsx
    │   ├── Projections.tsx
    │   └── Settings.tsx
    ├── store/
    │   └── useFinanceStore.ts   (Zustand — caches Supabase data locally for speed)
    ├── lib/
    │   ├── supabase.ts          (Supabase client)
    │   ├── calculations.ts      (all financial formulas)
    │   ├── formatters.ts        (COP formatting, date helpers)
    │   └── seedData.ts          (first-time user seeding)
    └── types/
        └── index.ts             (all TypeScript interfaces)
```

---

## DATA FETCHING PATTERN

Use a **Zustand + Supabase** hybrid pattern:
- On app load (after auth), fetch all user data from Supabase and store in Zustand
- All reads come from Zustand (fast, no loading spinners on navigation)
- All writes go to Supabase first, then update Zustand on success (optimistic updates optional)
- On spending entry save: insert to `spending_entries` → update local store → show toast

---

## FINAL NOTES FOR THE AI BUILDER

## VS CODE SETUP — HOW TO SCAFFOLD THIS PROJECT

Run these commands in your terminal to get the project started from scratch:

```bash
# 1. Scaffold Vite + React + TypeScript
npm create vite@latest financeos -- --template react-ts
cd financeos

# 2. Install all dependencies
npm install
npm install @supabase/supabase-js
npm install zustand
npm install react-router-dom
npm install recharts
npm install lucide-react
npm install react-countup
npm install clsx tailwind-merge class-variance-authority
npm install @radix-ui/react-dialog @radix-ui/react-slot @radix-ui/react-toast @radix-ui/react-select @radix-ui/react-switch
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
npx tailwindcss init -p

# 3. Set up shadcn/ui
npx shadcn-ui@latest init
# When prompted: TypeScript=yes, style=Default, base color=Slate, CSS variables=yes

# 4. Add shadcn components you'll need
npx shadcn-ui@latest add button input card dialog toast select switch badge progress sheet

# 5. Create .env.local
touch .env.local
# Then add:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# 6. Initialize git and push to GitHub
git init
git add .
git commit -m "initial scaffold"
gh repo create financeos --private --push --source=.
# (requires GitHub CLI — or create repo manually on github.com and follow their push instructions)
```

### Recommended VS Code Extensions
Install these for the best DX on this project:
- **Tailwind CSS IntelliSense** — autocomplete for Tailwind classes
- **ESLint** — catch errors early
- **Prettier** — auto-format on save
- **Supabase** — optional but useful for browsing your DB from VS Code
- **GitHub Copilot** — your vibe coding co-pilot

### Order of Implementation (build in this sequence)
1. `src/lib/supabase.ts` — client setup first
2. Supabase SQL migration — run in dashboard before any code touches the DB
3. `src/types/index.ts` — all interfaces
4. `src/lib/seedData.ts` — seeding function
5. `src/pages/Login.tsx` + auth guard — get auth working end-to-end
6. `src/store/useFinanceStore.ts` — Zustand store with Supabase fetch logic
7. `src/lib/calculations.ts` + `formatters.ts` — pure functions, no UI
8. Layout shell (Sidebar + BottomNav + routing)
9. Dashboard page — the most important screen
10. Spending page + Add Spending drawer
11. Monthly Update page
12. Projections page
13. Settings page
14. PWA config + Vercel deploy

---

## FINAL NOTES

- **Auth first**: The app is useless without the Supabase connection. Set up auth, RLS, and the client before building any UI pages.
- **Run the SQL migration** in the Supabase dashboard SQL editor before writing any app code — all tables must exist first.
- **Environment variables** must be in both `.env.local` (local dev) and Vercel project settings (production). The app will silently fail if these are missing.
- The app should feel like a premium fintech product — think **Revolut or Nubank** aesthetics.
- Prioritize the **Dashboard** and **Spending** pages — they're used daily.
- The **Projections** sliders should feel real-time and snappy (use `useMemo` for heavy calculations).
- The currency is **always displayed in COP** — USD values are converted at the stored exchange rate.
- **Do not use any Node.js-only APIs** (`fs`, `path`, `crypto`) — the app must run in a browser and eventually a Capacitor WebView.
- All data entry optimized for speed: minimal taps to log a purchase, autofocus inputs, enter-key submission.

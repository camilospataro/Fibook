import { supabase } from './supabase';

export async function seedUserData(userId: string) {
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

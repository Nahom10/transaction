import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import type { AccountBalance, Account, Entry } from '@/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: balances }, { data: accounts }, { data: entries }] = await Promise.all([
    supabase.from('account_balances').select('*').order('id'),
    supabase.from('accounts').select('*').order('id'),
    supabase
      .from('entries')
      .select('*, paid_from_account:accounts!paid_from(name)')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  return (
    <Dashboard
      initialBalances={(balances as AccountBalance[]) ?? []}
      initialAccounts={(accounts as Account[]) ?? []}
      initialEntries={(entries as Entry[]) ?? []}
    />
  );
}

'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { AccountBalance, Account, Entry } from '@/types';
import { monthRange } from '@/lib/utils';
import BalancesTable from '@/components/BalancesTable';
import EntryForm from '@/components/EntryForm';
import EntriesList from '@/components/EntriesList';

interface Props {
  initialBalances: AccountBalance[];
  initialAccounts: Account[];
  initialEntries: Entry[];
  initialYear: number;
  initialMonth: number;
}

export default function Dashboard({
  initialBalances,
  initialAccounts,
  initialEntries,
  initialYear,
  initialMonth,
}: Props) {

  const router = useRouter();
  const [balances, setBalances] = useState(initialBalances);
  const [accounts] = useState(initialAccounts);
  const [entries, setEntries] = useState(initialEntries);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [activeTab, setActiveTab] = useState<'balances' | 'entry' | 'list'>('list');

  const refreshBalances = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.from('account_balances').select('*').order('id');
    if (data) setBalances(data as AccountBalance[]);
  }, []);

  const refreshEntries = useCallback(async (y: number, m: number) => {
    const sb = createClient();
    const { from, to } = monthRange(y, m);
    const { data } = await sb
      .from('entries')
      .select('*, paid_from_account:accounts!paid_from(name)')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) setEntries(data as Entry[]);
  }, []);

  const handleYearMonthChange = useCallback((y: number, m: number) => {
    setYear(y);
    setMonth(m);
    refreshEntries(y, m);
  }, [refreshEntries]);

  const handleSaved = useCallback(() => {
    refreshBalances();
    refreshEntries(year, month);
    setActiveTab('list');
  }, [refreshBalances, refreshEntries, year, month]);

  async function handleLogout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏦</span>
            <h1 className="text-white font-bold text-lg leading-tight">Shop Bank Tracker</h1>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="text-slate-400 hover:text-white text-sm bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-[57px] z-10 bg-slate-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex">
            {([ 
              { id: 'balances', label: '💰 Balances' },
              { id: 'entry',    label: '➕ New Entry' },
              { id: 'list',     label: '📋 Entries' },
            ] as { id: typeof activeTab; label: string }[]).map(tab => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-20">
        {activeTab === 'balances' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-base">Account Balances</h2>
            <BalancesTable balances={balances} onRefresh={refreshBalances} />
          </div>
        )}

        {activeTab === 'entry' && (
          <EntryForm accounts={accounts} onSaved={handleSaved} />
        )}

        {activeTab === 'list' && (
          <EntriesList
            entries={entries}
            accounts={accounts}
            year={year}
            month={month}
            onYearMonthChange={handleYearMonthChange}
            onRefresh={() => { refreshBalances(); refreshEntries(year, month); }}
          />
        )}
      </main>
    </div>
  );
}

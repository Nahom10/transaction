'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { AccountBalance, Account, Entry } from '@/types';
import { monthRange } from '@/lib/utils';
import BalancesTable from '@/components/BalancesTable';
import EntryForm from '@/components/EntryForm';
import EntriesList from '@/components/EntriesList';
import { BankIcon, PlusCircleIcon, FileTextIcon, WalletIcon, LogOutIcon, SparklesIcon } from '@/components/Icons';

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

  const missingReceiptsCount = entries.filter(e => !e.receipt_path).length;

  return (
    <div className="relative min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Radiant ambient glow overlay */}
      <div className="ambient-bg" />

      {/* Modern Top Header */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/[0.08] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950/80 rounded-[11px] flex items-center justify-center text-emerald-400 backdrop-blur-sm">
                <BankIcon size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold text-base sm:text-lg tracking-tight">Shop Bank Tracker</h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ETB Live
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Dashen • CBE • Telebirr</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.05] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 border border-white/[0.08] transition-all duration-200 active:scale-95"
            >
              <LogOutIcon size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Segmented Navigation */}
      <div className="sticky top-16 z-20 glass-panel border-b border-white/[0.06] py-2.5 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-white/[0.06] shadow-inner">
            {[
              { id: 'list', label: 'Entries & Activity', icon: FileTextIcon, badge: missingReceiptsCount > 0 ? `${missingReceiptsCount} missing` : null },
              { id: 'entry', label: 'New Entry', icon: PlusCircleIcon, highlight: true },
              { id: 'balances', label: 'Accounts & Balances', icon: WalletIcon },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/30 shadow-md shadow-emerald-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
                  <span className="hidden xs:inline">{tab.label}</span>
                  <span className="xs:hidden">{tab.id === 'list' ? 'Entries' : tab.id === 'entry' ? 'Add' : 'Balances'}</span>

                  {tab.badge && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 pb-24">
        {activeTab === 'balances' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg sm:text-xl tracking-tight">Account Balances & Reconciliation</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Compare internal system ledger balances against official bank statements.</p>
              </div>
            </div>
            <BalancesTable balances={balances} onRefresh={refreshBalances} />
          </div>
        )}

        {activeTab === 'entry' && (
          <div className="animate-in fade-in duration-200">
            <EntryForm accounts={accounts} onSaved={handleSaved} />
          </div>
        )}

        {activeTab === 'list' && (
          <div className="animate-in fade-in duration-200">
            <EntriesList
              entries={entries}
              accounts={accounts}
              year={year}
              month={month}
              onYearMonthChange={handleYearMonthChange}
              onRefresh={() => {
                refreshBalances();
                refreshEntries(year, month);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

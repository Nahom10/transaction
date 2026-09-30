'use client';

import { useState, useTransition } from 'react';
import { AccountBalance } from '@/types';
import { formatBirr } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';
import {
  BankIcon,
  WalletIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  Edit3Icon,
  CheckIcon,
  XIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ShieldCheckIcon
} from '@/components/Icons';

interface Props {
  balances: AccountBalance[];
  onRefresh: () => void;
}

export default function BalancesTable({ balances, onRefresh }: Props) {
  const [editing, setEditing] = useState<Record<string, { opening: string; statement: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function startEdit(acc: AccountBalance) {
    setEditing(prev => ({
      ...prev,
      [acc.id]: {
        opening: String(acc.opening),
        statement: String(acc.statement_balance),
      },
    }));
  }

  function cancelEdit(id: number | string) {
    setEditing(prev => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  async function saveEdit(acc: AccountBalance) {
    const vals = editing[acc.id];
    if (!vals) return;
    setSaving(String(acc.id));
    const opening = parseFloat(vals.opening) || 0;
    const statement = parseFloat(vals.statement) || 0;
    const supabase = createClient();
    await supabase
      .from('accounts')
      .update({ opening_balance: opening, statement_balance: statement })
      .eq('id', acc.id);
    setEditing(prev => {
      const n = { ...prev };
      delete n[acc.id];
      return n;
    });
    setSaving(null);
    startTransition(() => onRefresh());
  }

  // Aggregate totals
  const totalSystemBalance = balances.reduce((sum, b) => sum + b.balance, 0);
  const totalStatementBalance = balances.reduce((sum, b) => sum + b.statement_balance, 0);
  const totalDiscrepancy = totalStatementBalance - totalSystemBalance;
  const isOverallBalanced = Math.abs(totalDiscrepancy) < 0.005;

  return (
    <div className="space-y-6">
      {/* Portfolio Total Net Worth Card */}
      <div className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-7 border border-white/[0.1] shadow-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-emerald-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <ShieldCheckIcon size={16} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Liquid Funds (All Accounts)
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight mt-2">
              {formatBirr(totalSystemBalance)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              isOverallBalanced
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}>
              {isOverallBalanced ? (
                <>
                  <CheckCircleIcon size={16} className="text-emerald-400" />
                  <span>All Accounts Fully Reconciled</span>
                </>
              ) : (
                <>
                  <AlertCircleIcon size={16} className="text-amber-400" />
                  <span>{totalDiscrepancy > 0 ? '+' : ''}{formatBirr(totalDiscrepancy)} Discrepancy</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {balances.map(acc => {
          const isEditing = !!editing[acc.id];
          const diff = acc.statement_balance - acc.balance;
          const balanced = Math.abs(diff) < 0.005;
          const editVals = editing[acc.id];
          const isSaving = saving === String(acc.id);

          const isDashen = acc.name.toLowerCase().includes('dashen');
          const isCBE = acc.name.toLowerCase().includes('cbe');
          const isTelebirr = acc.name.toLowerCase().includes('telebirr');

          const accentColor = isDashen ? 'emerald' : isCBE ? 'teal' : 'cyan';

          return (
            <div
              key={acc.id}
              className={`glass-card rounded-2xl p-5 border transition-all duration-200 ${
                balanced
                  ? 'border-white/[0.08] hover:border-emerald-500/30'
                  : 'border-amber-500/30 shadow-lg shadow-amber-950/20'
              }`}
            >
              {/* Account Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isTelebirr
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : isCBE
                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {isTelebirr ? <WalletIcon size={18} /> : <BankIcon size={18} />}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm tracking-tight">{acc.name}</h3>
                    <span className="text-[11px] text-slate-400">Account #{acc.id}</span>
                  </div>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => startEdit(acc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Edit Opening / Statement balance"
                  >
                    <Edit3Icon size={15} />
                  </button>
                )}
              </div>

              {/* Main Balance */}
              <div className="py-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  System Tracked Balance
                </span>
                <div className="text-2xl font-bold font-mono text-white tracking-tight mt-0.5">
                  {formatBirr(acc.balance)}
                </div>
              </div>

              {/* Inflow & Outflow stats */}
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/50 border border-white/[0.04] mb-4 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                    <TrendingUpIcon size={11} className="text-emerald-400" />
                    Money In
                  </div>
                  <div className="text-emerald-400 font-bold mt-0.5">+{formatBirr(acc.money_in)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                    <TrendingDownIcon size={11} className="text-rose-400" />
                    Money Out
                  </div>
                  <div className="text-rose-400 font-bold mt-0.5">-{formatBirr(acc.money_out)}</div>
                </div>
              </div>

              {/* Bank Statement & Reconciliation Section */}
              <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
                {isEditing ? (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Opening Balance (ETB)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editVals.opening}
                        onChange={e =>
                          setEditing(prev => ({
                            ...prev,
                            [acc.id]: { ...prev[acc.id], opening: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-900 border border-white/20 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Real Statement Balance (ETB)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editVals.statement}
                        onChange={e =>
                          setEditing(prev => ({
                            ...prev,
                            [acc.id]: { ...prev[acc.id], statement: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-900 border border-white/20 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => saveEdit(acc)}
                        disabled={isSaving}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-1 transition-all"
                      >
                        <CheckIcon size={14} />
                        <span>{isSaving ? 'Saving…' : 'Save'}</span>
                      </button>
                      <button
                        onClick={() => cancelEdit(acc.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-300 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Statement Balance:</span>
                      <span className="text-slate-200 font-mono font-semibold">
                        {formatBirr(acc.statement_balance)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Opening Balance:</span>
                      <span className="text-slate-400 font-mono">
                        {formatBirr(acc.opening)}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      {balanced ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          <CheckCircleIcon size={12} className="text-emerald-400" />
                          <span>Balanced</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          <AlertCircleIcon size={12} className="text-amber-400" />
                          <span>{diff > 0 ? '+' : ''}{formatBirr(diff)}</span>
                        </div>
                      )}

                      <span className="text-[11px] text-slate-500 font-mono">
                        {balanced ? 'Zero diff' : 'Difference'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

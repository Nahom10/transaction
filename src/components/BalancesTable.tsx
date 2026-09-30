'use client';

import { useState, useTransition } from 'react';
import { AccountBalance } from '@/types';
import { formatBirr } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';

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

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-slate-400">
            <th className="px-4 py-3 text-left font-medium">Account</th>
            <th className="px-4 py-3 text-right font-medium">Opening</th>
            <th className="px-4 py-3 text-right font-medium">Money In</th>
            <th className="px-4 py-3 text-right font-medium">Money Out</th>
            <th className="px-4 py-3 text-right font-medium">My Balance</th>
            <th className="px-4 py-3 text-right font-medium">Real Balance</th>
            <th className="px-4 py-3 text-right font-medium">Diff</th>
            <th className="px-4 py-3 text-center font-medium">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {balances.map(acc => {
            const isEditing = !!editing[acc.id];
            const diff = acc.statement_balance - acc.balance;
            const balanced = Math.abs(diff) < 0.005;
            const editVals = editing[acc.id];

            return (
              <tr key={acc.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-semibold text-white">{acc.name}</td>

                {/* Opening balance */}
                <td className="px-4 py-3 text-right">
                  {isEditing ? (
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
                      className="w-28 bg-white/10 border border-emerald-500/50 text-white rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  ) : (
                    <span className="text-slate-300">{formatBirr(acc.opening)}</span>
                  )}
                </td>

                {/* Money in */}
                <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                  {formatBirr(acc.money_in)}
                </td>

                {/* Money out */}
                <td className="px-4 py-3 text-right text-rose-400 font-mono">
                  {formatBirr(acc.money_out)}
                </td>

                {/* My balance */}
                <td className="px-4 py-3 text-right text-white font-mono font-semibold">
                  {formatBirr(acc.balance)}
                </td>

                {/* Real balance */}
                <td className="px-4 py-3 text-right">
                  {isEditing ? (
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
                      className="w-28 bg-white/10 border border-emerald-500/50 text-white rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  ) : (
                    <span className="text-slate-300 font-mono">{formatBirr(acc.statement_balance)}</span>
                  )}
                </td>

                {/* Difference */}
                <td className={`px-4 py-3 text-right font-mono font-semibold ${balanced ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {balanced ? '—' : (diff >= 0 ? '+' : '') + formatBirr(diff)}
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-center">
                  {balanced ? (
                    <span className="inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-3 py-0.5 text-xs font-bold">
                      ✓ BALANCED
                    </span>
                  ) : (
                    <span className="inline-block bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-3 py-0.5 text-xs font-bold animate-pulse">
                      ⚠ CHECK
                    </span>
                  )}
                </td>

                {/* Edit / Save */}
                <td className="px-4 py-3 text-right">
                  {isEditing ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        id={`save-balance-${acc.id}`}
                        onClick={() => saveEdit(acc)}
                        disabled={saving === String(acc.id)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {saving === String(acc.id) ? '…' : 'Save'}
                      </button>
                      <button
                        onClick={() =>
                          setEditing(prev => {
                            const n = { ...prev };
                            delete n[acc.id];
                            return n;
                          })
                        }
                        className="bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg px-3 py-1 text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      id={`edit-balance-${acc.id}`}
                      onClick={() => startEdit(acc)}
                      className="bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg px-3 py-1 text-xs font-bold transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

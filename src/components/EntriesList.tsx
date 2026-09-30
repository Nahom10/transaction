'use client';

import { useState } from 'react';
import { Entry, Account, KIND_LABELS, KIND_FROM_TO, EntryKind } from '@/types';
import { formatBirr, formatDate, monthRange } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';

interface Props {
  entries: Entry[];
  accounts: Account[];
  year: number;
  month: number;
  onYearMonthChange: (year: number, month: number) => void;
  onRefresh: () => void;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function downloadCSV(entries: Entry[], year: number, month: number) {
  const header = ['Date','What Happened','From','To','Note','Amount','Receipt'];
  const rows = entries.map(e => {
    const ft = KIND_FROM_TO[e.kind];
    const from = e.kind === 'paid_supplier'
      ? (e.paid_from_account?.name ?? '')
      : (ft.from ?? '');
    const to = e.kind === 'paid_supplier' ? '' : (ft.to ?? '');
    return [
      e.entry_date,
      KIND_LABELS[e.kind],
      from,
      to,
      e.note ?? '',
      e.amount,
      e.receipt_path ? 'Yes' : 'No',
    ];
  });
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shop-bank-${year}-${String(month).padStart(2,'0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EntriesList({ entries, accounts, year, month, onYearMonthChange, onRefresh }: Props) {
  const [filterAccount, setFilterAccount] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

  // Filtered entries
  const filtered = entries.filter(e => {
    if (filterAccount) {
      const ft = KIND_FROM_TO[e.kind];
      const accountsInvolved = [
        ft.from,
        ft.to,
        e.kind === 'paid_supplier' ? e.paid_from_account?.name : undefined,
      ].filter(Boolean);
      if (!accountsInvolved.includes(filterAccount)) return false;
    }
    if (filterSupplier) {
      if (!e.note?.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
    }
    return true;
  });

  async function openReceipt(path: string) {
    const res = await fetch(`/api/signed-url?path=${encodeURIComponent(path)}`);
    const { url } = await res.json();
    window.open(url, '_blank');
  }

  async function addReceipt(entryId: string, file: File) {
    setUploadingId(entryId);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entry_id', entryId);
      const res = await fetch('/api/receipt', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setUploadError('Upload failed: ' + (j.error ?? res.statusText));
      }
    } catch (err) {
      setUploadError('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingId(null);
      onRefresh();
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('entries').delete().eq('id', id);
    setDeletingId(null);
    onRefresh();
  }

  // Month totals
  const totalSalesDeposited    = entries.filter(e => e.kind === 'sales_deposited').reduce((s, e) => s + e.amount, 0);
  const totalSalesDepositedCBE = entries.filter(e => e.kind === 'sales_deposited_cbe').reduce((s, e) => s + e.amount, 0);
  const totalTelebirrSales     = entries.filter(e => e.kind === 'telebirr_sales').reduce((s, e) => s + e.amount, 0);
  const totalTransfers         = entries.filter(e => ['telebirr_to_cbe','telebirr_to_dashen','dashen_to_telebirr','cbe_to_telebirr'].includes(e.kind)).reduce((s, e) => s + e.amount, 0);
  const totalSuppliers         = entries.filter(e => e.kind === 'paid_supplier').reduce((s, e) => s + e.amount, 0);
  const missingReceipts        = entries.filter(e => !e.receipt_path).length;

  // Supplier summary
  const supplierMap: Record<string, number> = {};
  entries.filter(e => e.kind === 'paid_supplier').forEach(e => {
    const name = e.note?.trim() || 'Unknown';
    supplierMap[name] = (supplierMap[name] || 0) + e.amount;
  });
  const supplierSummary = Object.entries(supplierMap).sort((a, b) => b[1] - a[1]);

  // Prev/next month
  function prevMonth() {
    if (month === 1) onYearMonthChange(year - 1, 12);
    else onYearMonthChange(year, month - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) onYearMonthChange(year + 1, 1);
    else onYearMonthChange(year, month + 1);
  }

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
        <button
          id="prev-month"
          onClick={prevMonth}
          className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-4 py-2 text-lg font-bold transition-colors"
        >←</button>
        <span className="text-white font-semibold text-lg">{MONTHS[month-1]} {year}</span>
        <button
          id="next-month"
          onClick={nextMonth}
          className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-4 py-2 text-lg font-bold transition-colors"
        >→</button>
      </div>

      {/* Month totals */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Sales (Dashen)', val: totalSalesDeposited,    color: 'emerald' },
          { label: 'Sales (CBE)',    val: totalSalesDepositedCBE, color: 'teal' },
          { label: 'Telebirr Sales', val: totalTelebirrSales,     color: 'cyan' },
          { label: 'Transfers',      val: totalTransfers,         color: 'violet' },
          { label: 'Paid Suppliers', val: totalSuppliers,         color: 'rose' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-3`}>
            <div className={`text-${color}-400 text-xs font-medium mb-1`}>{label}</div>
            <div className="text-white font-bold text-base font-mono">{formatBirr(val)}</div>
          </div>
        ))}
      </div>

      {missingReceipts > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-2xl">🧾</span>
          <div>
            <div className="text-red-400 font-bold">{missingReceipts} receipt{missingReceipts > 1 ? 's' : ''} missing this month</div>
            <div className="text-red-300/70 text-xs">Add receipts to entries marked MISSING below.</div>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <div className="text-orange-400 font-bold text-sm">{uploadError}</div>
            <div className="text-orange-300/70 text-xs mt-0.5">Check that the Supabase storage bucket &quot;receipts&quot; exists and policies are set.</div>
          </div>
          <button onClick={() => setUploadError('')} className="text-orange-400 hover:text-white text-lg leading-none">✕</button>
        </div>
      )}

      {/* Supplier summary */}
      {supplierSummary.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-white font-semibold mb-3 text-sm">Supplier Summary</h3>
          <div className="space-y-2">
            {supplierSummary.map(([name, total]) => (
              <div key={name} className="flex justify-between items-center">
                <span className="text-slate-300 text-sm">{name}</span>
                <span className="text-rose-400 font-mono font-semibold text-sm">{formatBirr(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <select
          id="filter-account"
          value={filterAccount}
          onChange={e => setFilterAccount(e.target.value)}
          className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
        </select>
        <input
          id="filter-supplier"
          type="text"
          placeholder="Filter by supplier…"
          value={filterSupplier}
          onChange={e => setFilterSupplier(e.target.value)}
          className="flex-1 bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          id="export-csv"
          onClick={() => downloadCSV(entries, year, month)}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl px-3 py-2 text-sm font-bold transition-colors"
          title="Export CSV"
        >
          CSV
        </button>
      </div>

      {/* Entries list */}
      {filtered.length === 0 ? (
        <div className="text-slate-500 text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
          No entries for this period.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => {
            const ft = KIND_FROM_TO[entry.kind as EntryKind];
            const fromAcc = entry.kind === 'paid_supplier'
              ? entry.paid_from_account?.name
              : ft.from;
            const toAcc = entry.kind === 'paid_supplier' ? null : ft.to;
            const hasReceipt = !!entry.receipt_path;

            return (
              <div key={entry.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-400">{formatDate(entry.entry_date)}</div>
                    <div className="text-white font-semibold text-sm mt-0.5 leading-snug">
                      {KIND_LABELS[entry.kind]}
                    </div>
                    {(fromAcc || toAcc) && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {fromAcc && <span className="text-rose-400">{fromAcc}</span>}
                        {fromAcc && toAcc && <span className="text-slate-500"> → </span>}
                        {toAcc && <span className="text-emerald-400">{toAcc}</span>}
                      </div>
                    )}
                    {entry.note && (
                      <div className="text-xs text-slate-300 mt-1 bg-white/5 rounded-lg px-2 py-1">
                        {entry.note}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white font-bold text-lg font-mono">{formatBirr(entry.amount)}</div>
                  </div>
                </div>

                {/* Bottom row: receipt + delete */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  {hasReceipt ? (
                    <button
                      id={`open-receipt-${entry.id}`}
                      onClick={() => openReceipt(entry.receipt_path!)}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                      📄 Open Receipt
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs font-bold">
                        🧾 MISSING
                      </span>
                      <label
                        htmlFor={`add-receipt-${entry.id}`}
                        className="bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors"
                      >
                        {uploadingId === entry.id ? 'Uploading…' : '+ Add'}
                      </label>
                      <input
                        id={`add-receipt-${entry.id}`}
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) addReceipt(entry.id, f);
                        }}
                      />
                    </div>
                  )}
                  <button
                    id={`delete-entry-${entry.id}`}
                    onClick={() => deleteEntry(entry.id)}
                    disabled={deletingId === entry.id}
                    className="ml-auto bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {deletingId === entry.id ? '…' : '🗑 Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

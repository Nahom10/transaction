'use client';

import { useState } from 'react';
import { Entry, Account, KIND_LABELS, KIND_FROM_TO, EntryKind } from '@/types';
import { formatBirr, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightLeftIcon,
  ReceiptIcon,
  DownloadIcon,
  SearchIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  FileTextIcon,
  XIcon,
  EyeIcon,
  CheckCircleIcon
} from '@/components/Icons';

interface Props {
  entries: Entry[];
  accounts: Account[];
  year: number;
  month: number;
  onYearMonthChange: (year: number, month: number) => void;
  onRefresh: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function downloadCSV(entries: Entry[], year: number, month: number) {
  const header = ['Date', 'What Happened', 'From', 'To', 'Note', 'Amount (ETB)', 'Receipt Attached'];
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
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shop-bank-${year}-${String(month).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EntriesList({ entries, accounts, year, month, onYearMonthChange, onRefresh }: Props) {
  const [filterAccount, setFilterAccount] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'sales' | 'transfers' | 'suppliers' | 'missing'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccessId, setUploadSuccessId] = useState<string | null>(null);

  // Filter logic
  const filtered = entries.filter(e => {
    if (quickFilter === 'sales') {
      if (!['sales_deposited', 'sales_deposited_cbe', 'telebirr_sales'].includes(e.kind)) return false;
    } else if (quickFilter === 'transfers') {
      if (!['telebirr_to_cbe', 'telebirr_to_dashen', 'dashen_to_telebirr', 'cbe_to_telebirr'].includes(e.kind)) return false;
    } else if (quickFilter === 'suppliers') {
      if (e.kind !== 'paid_supplier') return false;
    } else if (quickFilter === 'missing') {
      if (e.receipt_path) return false;
    }

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
    try {
      const res = await fetch(`/api/signed-url?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        alert('Could not generate receipt URL: ' + (data.error ?? 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to load receipt: ' + String(err));
    }
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
      } else {
        setUploadSuccessId(entryId);
        setTimeout(() => setUploadSuccessId(null), 3000);
      }
    } catch (err) {
      setUploadError('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingId(null);
      onRefresh();
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Are you sure you want to delete this transaction entry? This cannot be undone.')) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('entries').delete().eq('id', id);
    setDeletingId(null);
    onRefresh();
  }

  // Month totals calculations
  const totalSalesDeposited    = entries.filter(e => e.kind === 'sales_deposited').reduce((s, e) => s + e.amount, 0);
  const totalSalesDepositedCBE = entries.filter(e => e.kind === 'sales_deposited_cbe').reduce((s, e) => s + e.amount, 0);
  const totalTelebirrSales     = entries.filter(e => e.kind === 'telebirr_sales').reduce((s, e) => s + e.amount, 0);
  const totalTransfers         = entries.filter(e => ['telebirr_to_cbe','telebirr_to_dashen','dashen_to_telebirr','cbe_to_telebirr'].includes(e.kind)).reduce((s, e) => s + e.amount, 0);
  const totalSuppliers         = entries.filter(e => e.kind === 'paid_supplier').reduce((s, e) => s + e.amount, 0);
  const missingReceipts        = entries.filter(e => !e.receipt_path).length;

  // Supplier summary
  const supplierMap: Record<string, number> = {};
  entries.filter(e => e.kind === 'paid_supplier').forEach(e => {
    const name = e.note?.trim() || 'Unknown Supplier';
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

  function goToCurrentMonth() {
    const now = new Date();
    onYearMonthChange(now.getFullYear(), now.getMonth() + 1);
  }

  return (
    <div className="space-y-6">
      {/* Month Navigator Header */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <button
          id="prev-month"
          onClick={prevMonth}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white border border-white/[0.08] transition-all active:scale-95"
          title="Previous Month"
        >
          <ChevronLeftIcon size={18} />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-white font-extrabold text-lg sm:text-xl tracking-tight">
              {MONTHS[month - 1]} {year}
            </span>
          </div>
          <button
            onClick={goToCurrentMonth}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold tracking-wide transition-colors mt-0.5"
          >
            Go to Current Month
          </button>
        </div>

        <button
          id="next-month"
          onClick={nextMonth}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white border border-white/[0.08] transition-all active:scale-95"
          title="Next Month"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

      {/* Monthly Summary Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Sales (Dashen)', val: totalSalesDeposited, color: 'emerald', border: 'border-emerald-500/25', bg: 'from-emerald-500/10 to-transparent', icon: TrendingUpIcon },
          { label: 'Sales (CBE)', val: totalSalesDepositedCBE, color: 'teal', border: 'border-teal-500/25', bg: 'from-teal-500/10 to-transparent', icon: TrendingUpIcon },
          { label: 'Telebirr Sales', val: totalTelebirrSales, color: 'cyan', border: 'border-cyan-500/25', bg: 'from-cyan-500/10 to-transparent', icon: TrendingUpIcon },
          { label: 'Transfers', val: totalTransfers, color: 'indigo', border: 'border-indigo-500/25', bg: 'from-indigo-500/10 to-transparent', icon: ArrowRightLeftIcon },
          { label: 'Paid Suppliers', val: totalSuppliers, color: 'rose', border: 'border-rose-500/25', bg: 'from-rose-500/10 to-transparent', icon: TrendingDownIcon },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl p-3.5 border ${item.border} bg-gradient-to-b ${item.bg} bg-slate-900/60 backdrop-blur-md shadow-md flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.label}
                </span>
                <span className={`p-1 rounded-lg bg-white/[0.05] text-${item.color}-400`}>
                  <Icon size={14} />
                </span>
              </div>
              <div>
                <div className="text-white font-bold text-base sm:text-lg font-mono tracking-tight">
                  {formatBirr(item.val)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Missing Receipts Alert Banner */}
      {missingReceipts > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 backdrop-blur-md shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ReceiptIcon size={20} />
            </div>
            <div>
              <div className="text-white font-bold text-sm flex items-center gap-2">
                <span>{missingReceipts} Receipt{missingReceipts > 1 ? 's' : ''} Missing</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Action Required
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Upload receipts directly below to keep account reconciliation accurate and audit-ready.
              </p>
            </div>
          </div>
          <button
            onClick={() => setQuickFilter(quickFilter === 'missing' ? 'all' : 'missing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              quickFilter === 'missing'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white/[0.08] hover:bg-white/[0.15] text-amber-300 border border-amber-500/30'
            }`}
          >
            {quickFilter === 'missing' ? 'Show All Entries' : 'Filter Missing Receipts'}
          </button>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 backdrop-blur-md shadow-lg flex items-start gap-3 animate-in fade-in">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <AlertCircleIcon size={18} />
          </div>
          <div className="flex-1">
            <h4 className="text-rose-300 font-bold text-sm">Upload Error</h4>
            <p className="text-rose-200/80 text-xs mt-0.5 font-mono">{uploadError}</p>
          </div>
          <button
            onClick={() => setUploadError('')}
            className="text-rose-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Supplier Summary Card (if any suppliers paid) */}
      {supplierSummary.length > 0 && (
        <div className="glass-card rounded-2xl p-4 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingDownIcon size={14} />
              </span>
              <h3 className="text-white font-bold text-sm tracking-tight">Supplier Expenses Breakdown</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {supplierSummary.length} recipient{supplierSummary.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {supplierSummary.map(([name, total]) => (
              <div key={name} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <span className="text-slate-300 text-xs font-medium truncate max-w-[60%]">{name}</span>
                <span className="text-rose-400 font-mono font-bold text-xs">{formatBirr(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-card rounded-2xl p-3.5 border border-white/[0.08] space-y-3">
        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Activity' },
            { id: 'sales', label: 'Sales Inflow' },
            { id: 'transfers', label: 'Bank Transfers' },
            { id: 'suppliers', label: 'Supplier Outflow' },
            { id: 'missing', label: 'Missing Receipts' },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setQuickFilter(chip.id as typeof quickFilter)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                quickFilter === chip.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950/40'
                  : 'bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] border border-white/[0.05]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Detailed Filters & CSV Button */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-white/[0.06]">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <SearchIcon size={14} />
            </div>
            <input
              id="filter-supplier"
              type="text"
              placeholder="Search by notes or supplier name…"
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/[0.1] text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>

          <div className="flex gap-2">
            <select
              id="filter-account"
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="bg-slate-950/60 border border-white/[0.1] text-white rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            >
              <option value="">All Accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>

            <button
              id="export-csv"
              onClick={() => downloadCSV(entries, year, month)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 bg-white/[0.06] hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30 border border-white/[0.08] transition-all active:scale-95"
              title="Download formatted CSV report"
            >
              <DownloadIcon size={14} />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Entries List Feed */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/[0.06]">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-500 flex items-center justify-center mx-auto mb-3">
            <FileTextIcon size={24} />
          </div>
          <h4 className="text-white font-semibold text-sm">No transactions found</h4>
          <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
            There are no entries matching your current filters for {MONTHS[month - 1]} {year}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {filtered.length} Transaction{filtered.length > 1 ? 's' : ''}
            </span>
          </div>

          {filtered.map(entry => {
            const ft = KIND_FROM_TO[entry.kind as EntryKind];
            const fromAcc = entry.kind === 'paid_supplier'
              ? entry.paid_from_account?.name
              : ft.from;
            const toAcc = entry.kind === 'paid_supplier' ? null : ft.to;
            const hasReceipt = !!entry.receipt_path;
            const isUploading = uploadingId === entry.id;
            const isDeleting = deletingId === entry.id;
            const justUploaded = uploadSuccessId === entry.id;

            const isIncome = ['sales_deposited', 'sales_deposited_cbe', 'telebirr_sales'].includes(entry.kind);
            const isTransfer = ['telebirr_to_cbe', 'telebirr_to_dashen', 'dashen_to_telebirr', 'cbe_to_telebirr'].includes(entry.kind);

            return (
              <div
                key={entry.id}
                className="group relative glass-card glass-card-hover rounded-2xl p-4 border border-white/[0.08] transition-all duration-200"
              >
                {/* Header & Main Info */}
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Direction icon + Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isIncome
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : isTransfer
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isIncome ? (
                        <TrendingUpIcon size={16} />
                      ) : isTransfer ? (
                        <ArrowRightLeftIcon size={16} />
                      ) : (
                        <TrendingDownIcon size={16} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm tracking-tight">
                          {KIND_LABELS[entry.kind]}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {formatDate(entry.entry_date)}
                        </span>
                      </div>

                      {/* Route flow */}
                      {(fromAcc || toAcc) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          {fromAcc && <span className="text-slate-300 font-semibold">{fromAcc}</span>}
                          {fromAcc && toAcc && <span className="text-slate-500">→</span>}
                          {toAcc && <span className="text-emerald-400 font-semibold">{toAcc}</span>}
                        </div>
                      )}

                      {/* Notes / Supplier Description */}
                      {entry.note && (
                        <div className="text-xs text-slate-300 mt-2 bg-slate-950/50 border border-white/[0.05] rounded-xl px-2.5 py-1.5 inline-block max-w-full truncate">
                          💬 {entry.note}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount */}
                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-extrabold text-base sm:text-lg tracking-tight ${
                        isIncome
                          ? 'text-emerald-400'
                          : isTransfer
                          ? 'text-indigo-300'
                          : 'text-rose-400'
                      }`}
                    >
                      {isIncome ? '+' : isTransfer ? '' : '-'}{formatBirr(entry.amount)}
                    </div>
                  </div>
                </div>

                {/* Bottom action toolbar: Receipt + Delete */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    {hasReceipt ? (
                      <button
                        id={`open-receipt-${entry.id}`}
                        onClick={() => openReceipt(entry.receipt_path!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95 shadow-sm"
                        title="View attached document"
                      >
                        <EyeIcon size={14} />
                        <span>View Receipt</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <ReceiptIcon size={12} />
                          Missing
                        </span>

                        <label
                          htmlFor={`add-receipt-${entry.id}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 ${
                            isUploading
                              ? 'bg-slate-700 text-slate-300 animate-pulse'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          <span>{isUploading ? 'Uploading…' : '+ Attach Receipt'}</span>
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

                    {justUploaded && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold animate-in fade-in">
                        <CheckCircleIcon size={14} />
                        Saved!
                      </span>
                    )}
                  </div>

                  <button
                    id={`delete-entry-${entry.id}`}
                    onClick={() => deleteEntry(entry.id)}
                    disabled={isDeleting}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                    title="Delete entry"
                  >
                    <TrashIcon size={14} />
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

'use client';

import { useState } from 'react';
import { Account, EntryKind, KIND_LABELS } from '@/types';
import { createClient } from '@/lib/supabase-client';
import { todayISO } from '@/lib/utils';
import {
  PlusCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightLeftIcon,
  UploadCloudIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  XIcon,
  FileTextIcon
} from '@/components/Icons';

interface Props {
  accounts: Account[];
  onSaved: () => void;
}

export default function EntryForm({ accounts, onSaved }: Props) {
  const [date, setDate] = useState(todayISO());
  const [kind, setKind] = useState<EntryKind>('sales_deposited');
  const [amount, setAmount] = useState('');
  const [paidFrom, setPaidFrom] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const needsPaidFrom = kind === 'paid_supplier';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (needsPaidFrom && !paidFrom) {
      setError('Please select which account you paid the supplier from.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        entry_date: date,
        kind,
        amount: amt,
        note: note.trim() || null,
        paid_from: needsPaidFrom ? parseInt(paidFrom) : null,
      };

      const { data: entry, error: insertErr } = await supabase
        .from('entries')
        .insert(payload)
        .select()
        .single();

      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }

      // Upload receipt if selected
      if (file && entry) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('entry_id', entry.id);
        const res = await fetch('/api/receipt', { method: 'POST', body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          setError('Entry was created, but receipt upload failed: ' + (j.error ?? 'Unknown error'));
        }
      }

      // Reset form
      setAmount('');
      setNote('');
      setFile(null);
      setPaidFrom('');
      setSuccess('Transaction recorded successfully!');
      setTimeout(() => setSuccess(''), 3000);
      onSaved();
    } catch (err) {
      setError('An unexpected error occurred: ' + String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-2xl space-y-6 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <PlusCircleIcon size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg tracking-tight">Record Transaction</h2>
            <p className="text-xs text-slate-400">Add sales deposit, bank transfer, or supplier expense</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircleIcon size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5">
          <CheckCircleIcon size={16} className="shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Hero Amount Input */}
      <div className="bg-slate-950/60 rounded-2xl p-4 border border-white/[0.08] focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
          Transaction Amount
        </label>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-mono font-extrabold text-xl sm:text-2xl">
            ETB
          </span>
          <input
            id="entry-amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-transparent text-white font-mono font-extrabold text-2xl sm:text-3xl placeholder-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Date & What happened Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Transaction Date</label>
          <input
            id="entry-date"
            type="date"
            required
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-950/60 border border-white/[0.1] text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 [color-scheme:dark] transition-all"
          />
        </div>

        {/* Transaction Category */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Transaction Type</label>
          <select
            id="entry-kind"
            value={kind}
            onChange={e => setKind(e.target.value as EntryKind)}
            className="w-full bg-slate-950/90 border border-white/[0.1] text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
          >
            {(Object.entries(KIND_LABELS) as [EntryKind, string][]).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Paid from (if paid_supplier) */}
      {needsPaidFrom && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2 animate-in fade-in">
          <label className="block text-xs font-semibold text-rose-300">Paid from which bank account?</label>
          <select
            id="entry-paid-from"
            required
            value={paidFrom}
            onChange={e => setPaidFrom(e.target.value)}
            className="w-full bg-slate-950/80 border border-rose-500/30 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
          >
            <option value="">Select source account…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Note / Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          {needsPaidFrom ? 'Supplier Name / Invoice Info' : 'Description / Reference Note (Optional)'}
        </label>
        <input
          id="entry-note"
          type="text"
          placeholder={needsPaidFrom ? 'e.g. Al-Noor Wholesalers - Sugar 50kg' : 'e.g. Morning counter cash deposit'}
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full bg-slate-950/60 border border-white/[0.1] text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
        />
      </div>

      {/* Modern Receipt Dropzone */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Receipt Attachment (Image or PDF)
        </label>
        {file ? (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileTextIcon size={18} className="text-emerald-400 shrink-0" />
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[11px] text-emerald-300 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <XIcon size={16} />
            </button>
          </div>
        ) : (
          <label
            htmlFor="receipt-file-input"
            className="group flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-emerald-500/50 bg-white/[0.02] hover:bg-emerald-500/[0.04] cursor-pointer transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center mb-2 transition-all">
              <UploadCloudIcon size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
              Click to select or take photo of receipt
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Supports JPEG, PNG, WEBP, or PDF
            </span>
            <input
              id="receipt-file-input"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Submit Button */}
      <button
        id="submit-entry-btn"
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <span>Saving Transaction…</span>
        ) : (
          <>
            <PlusCircleIcon size={18} />
            <span>Record Transaction</span>
          </>
        )}
      </button>
    </form>
  );
}

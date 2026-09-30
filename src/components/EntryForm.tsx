'use client';

import { useState } from 'react';
import { Account, EntryKind, KIND_LABELS } from '@/types';
import { createClient } from '@/lib/supabase-client';
import { todayISO } from '@/lib/utils';

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
    if (!amt || amt <= 0) { setError('Enter a positive amount.'); return; }
    if (needsPaidFrom && !paidFrom) { setError('Select which account to pay from.'); return; }

    setSaving(true);

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

    if (insertErr) { setError(insertErr.message); setSaving(false); return; }

    // Upload receipt if selected
    if (file && entry) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entry_id', entry.id);
      const res = await fetch('/api/receipt', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json();
        setError('Entry saved but receipt upload failed: ' + j.error);
      }
    }

    // Reset form
    setAmount('');
    setNote('');
    setFile(null);
    setPaidFrom('');
    setSuccess('Entry saved!');
    setTimeout(() => setSuccess(''), 3000);
    setSaving(false);
    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4"
    >
      <h2 className="text-white text-lg font-bold">➕ New Entry</h2>

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl p-3 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl p-3 text-sm">{success}</div>
      )}

      {/* Date */}
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Date</label>
        <input
          id="entry-date"
          type="date"
          required
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
        />
      </div>

      {/* What happened */}
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">What happened</label>
        <select
          id="entry-kind"
          value={kind}
          onChange={e => setKind(e.target.value as EntryKind)}
          className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {(Object.entries(KIND_LABELS) as [EntryKind, string][]).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      {/* Paid from (only for paid_supplier) */}
      {needsPaidFrom && (
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Pay from account</label>
          <select
            id="entry-paid-from"
            value={paidFrom}
            onChange={e => setPaidFrom(e.target.value)}
            required
            className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select account…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Amount (Birr)</label>
        <input
          id="entry-amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Note / Supplier name */}
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">
          {needsPaidFrom ? 'Supplier name / Note' : 'Note (optional)'}
        </label>
        <input
          id="entry-note"
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={needsPaidFrom ? 'Supplier name…' : 'Optional note…'}
          className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Receipt upload */}
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Receipt photo / PDF (optional)</label>
        <label
          htmlFor="entry-receipt"
          className="flex items-center gap-3 w-full bg-white/10 border-2 border-dashed border-white/20 hover:border-emerald-500/50 text-slate-300 hover:text-white rounded-xl px-4 py-3 cursor-pointer transition-colors"
        >
          <span className="text-2xl">📷</span>
          <span className="text-sm">{file ? file.name : 'Tap to attach receipt or take photo'}</span>
        </label>
        <input
          id="entry-receipt"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>

      <button
        id="entry-submit"
        type="submit"
        disabled={saving}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-xl transition-colors shadow-lg shadow-emerald-500/20"
      >
        {saving ? 'Saving…' : 'Save Entry'}
      </button>
    </form>
  );
}

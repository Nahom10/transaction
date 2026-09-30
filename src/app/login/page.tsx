'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { BankIcon, AlertCircleIcon, CheckCircleIcon, ShieldCheckIcon } from '@/components/Icons';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/');
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setInfo('Account created successfully! Check your email to confirm, then sign in.');
        setMode('login');
        setPassword('');
      }
    }
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#0a0f1d] selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Radiant ambient glow */}
      <div className="ambient-bg" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1px] shadow-2xl shadow-emerald-500/30 mb-4">
            <div className="w-full h-full bg-slate-950/80 rounded-[15px] flex items-center justify-center text-emerald-400 backdrop-blur-sm">
              <BankIcon size={28} />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Shop Bank Tracker</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            Dashen Bank • CBE • Telebirr • ETB Ledger
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/[0.1] shadow-2xl">
          {/* Mode Switcher */}
          <div className="flex bg-slate-950/70 p-1.5 rounded-2xl border border-white/[0.06] mb-6">
            <button
              id="tab-login"
              type="button"
              onClick={() => { setMode('login'); setError(''); setInfo(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/15 text-emerald-300 border border-emerald-500/30 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-signup"
              type="button"
              onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/15 text-emerald-300 border border-emerald-500/30 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 mb-4 animate-in fade-in">
              <AlertCircleIcon size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 mb-4 animate-in fade-in">
              <CheckCircleIcon size={16} className="shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/[0.1] text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/[0.1] text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="••••••••"
              />
              {mode === 'signup' && (
                <p className="text-slate-500 text-[11px] mt-1">Must be at least 6 characters</p>
              )}
            </div>

            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In to Dashboard' : 'Create New Account')}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheckIcon size={13} className="text-emerald-400" />
              <span>Secured with Supabase Auth & PostgreSQL RLS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

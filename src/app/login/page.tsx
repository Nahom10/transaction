'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push('/');
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-4">
            <span className="text-4xl">🏦</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Shop Bank Tracker</h1>
          <p className="text-emerald-400 mt-1 text-sm">Manage your shop accounts in Birr</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-white text-lg font-semibold mb-5">Sign in</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-lg shadow-emerald-500/20 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

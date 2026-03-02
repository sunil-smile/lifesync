'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface QuickUser {
  name: string;
  email: string;
  initials: string;
  color: string;
  bgColor: string;
}

const QUICK_USERS: QuickUser[] = [
  {
    name: 'Sunil',
    email: 'sunil@lifesync.app',
    initials: 'S',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
  },
  {
    name: 'Vidhya',
    email: 'vidhya@lifesync.app',
    initials: 'V',
    color: '#EC4899',
    bgColor: '#FDF2F8',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: '/dashboard',
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickPick(user: QuickUser) {
    setEmail(user.email);
    setPassword('');
    setSelectedUser(user.name);
    setError('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500 rounded-full opacity-5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full opacity-5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg mb-4">
            <span className="text-white text-2xl font-bold">L</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">LifeSync</h1>
          <p className="text-slate-400 text-sm">Family Dashboard — Sunil & Vidhya</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Quick Pick Avatars */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 text-center">
              Quick select
            </p>
            <div className="flex gap-3 justify-center">
              {QUICK_USERS.map((user) => (
                <button
                  key={user.name}
                  type="button"
                  onClick={() => handleQuickPick(user)}
                  className="flex flex-col items-center gap-1.5 group focus:outline-none"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-150 ring-2 ring-transparent group-focus:ring-offset-2"
                    style={{
                      backgroundColor: selectedUser === user.name ? user.color : user.bgColor,
                      color: selectedUser === user.name ? '#fff' : user.color,
                      boxShadow:
                        selectedUser === user.name
                          ? `0 0 0 3px ${user.color}40`
                          : '0 0 0 2px #e2e8f0',
                    }}
                  >
                    {user.initials}
                  </div>
                  <span
                    className="text-xs font-semibold transition-colors"
                    style={{
                      color: selectedUser === user.name ? user.color : '#64748b',
                    }}
                  >
                    {user.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400 font-medium">
                sign in
              </span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedUser(null);
                  setError('');
                }}
                placeholder="you@lifesync.app"
                className="input"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter your password"
                className="input"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <span className="text-red-500 text-sm mt-0.5">&#9888;</span>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in to LifeSync'
              )}
            </button>
          </form>

        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          LifeSync &mdash; Built with love for Sunil & Vidhya
        </p>
      </div>
    </div>
  );
}

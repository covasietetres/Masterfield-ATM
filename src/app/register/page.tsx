'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, ShieldAlert, Cpu, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Access keys do not match.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-lg p-8 shadow-2xl border border-slate-700">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-amber-500/10 p-4 rounded-full mb-4 ring-1 ring-amber-500/30">
              <Cpu className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100 uppercase tracking-wider">
              Engineer Provisioning
            </h1>
            <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest font-semibold text-center">
              Generate New Access Key
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-6 text-sm flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-3 rounded mb-6 text-sm text-center">
              Provisioning successful. Redirecting to authentication portal...
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">
                Email / ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-amber-500 focus:border-amber-500 block w-full pl-10 p-2.5 outline-none transition-colors"
                  placeholder="engineer@domain.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">
                New Access Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-amber-500 focus:border-amber-500 block w-full pl-10 p-2.5 outline-none transition-colors"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">
                Confirm Access Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-amber-500 focus:border-amber-500 block w-full pl-10 p-2.5 outline-none transition-colors"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full text-slate-900 bg-amber-500 hover:bg-amber-400 focus:ring-4 focus:outline-none focus:ring-amber-800 font-bold rounded-md text-sm px-5 py-3 text-center uppercase tracking-widest transition-colors flex justify-center items-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Provision Identity'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already provisioned? <Link href="/login" className="text-amber-500 hover:text-amber-400 transition-colors">Authenticate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

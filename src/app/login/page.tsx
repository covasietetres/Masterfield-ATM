'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, Server, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError("Error desconocido en la respuesta del servidor.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-lg p-8 shadow-2xl border border-slate-700">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-500/10 p-4 rounded-full mb-4 ring-1 ring-blue-500/30">
              <Server className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100 uppercase tracking-wider">
              ATM Field Master
            </h1>
            <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest font-semibold text-center">
              Engineer Access Portal
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
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
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 outline-none transition-colors"
                  placeholder="engineer@domain.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2 uppercase tracking-wide">
                Access Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 outline-none transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800 font-medium rounded-md text-sm px-5 py-3 text-center uppercase tracking-widest transition-colors flex justify-center items-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authenticate'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            System protected by NCR/Diebold/GRG protocols.
            <br />
            Need access? <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors">Register Auth Key</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

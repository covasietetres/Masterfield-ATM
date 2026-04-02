'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Database, AlertTriangle, CheckCircle, Globe } from 'lucide-react';

export default function DebugPage() {
  const [clientEnv, setClientEnv] = useState<Record<string, string | undefined>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setClientEnv({
      NEXT_PUBLIC_SUPABASE_URL: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : 'process undefined',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : 'process undefined',
      NODE_ENV: process.env.NODE_ENV,
    });
  }, []);

  if (!mounted) return null;

  const isConfigured = !!(clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY && clientEnv.NEXT_PUBLIC_SUPABASE_URL !== 'undefined');

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <Shield className="w-8 h-8 text-blue-400" />
        <h1 className="text-2xl font-bold text-white tracking-tight">Portal de Diagnóstico</h1>
      </div>

      <div className="grid gap-4">
        {/* Status Card */}
        <div className={`p-4 rounded-xl border flex items-center gap-4 ${isConfigured ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          {isConfigured ? <CheckCircle className="text-emerald-400 w-6 h-6" /> : <AlertTriangle className="text-red-400 w-6 h-6" />}
          <div>
            <h2 className="font-bold text-white uppercase text-xs tracking-widest">Estado Global</h2>
            <p className="text-sm text-slate-400">{isConfigured ? 'Variables detectadas correctamente.' : 'Faltan variables críticas en el cliente.'}</p>
          </div>
        </div>

        {/* Browser Stats */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-200">
            <Globe className="w-4 h-4 text-slate-500" />
            <span className="text-xs uppercase tracking-widest font-black">Variables en el Navegador</span>
          </div>
          
          <div className="space-y-3 font-mono text-xs">
            {Object.entries(clientEnv).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">{key}:</span>
                <span className={value && value !== 'undefined' ? 'text-blue-400' : 'text-red-500 italic'}>
                  {value && value !== 'undefined' ? `PRESENTE (${value.substring(0, 8)}...)` : '¡VACÍO o UNDEFINED!'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Next.js Info */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-slate-200">
            <Database className="w-4 h-4 text-slate-500" />
            <span className="text-xs uppercase tracking-widest font-black">Información de Sistema</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Las variables con el prefijo <code className="text-blue-400 bg-blue-400/10 px-1 rounded font-mono">NEXT_PUBLIC_</code> 
            son inyectadas por Next.js durante la fase de <span className="font-bold text-white">Build</span> de Vercel. 
            Si las ves como vacías aquí, significa que la compilación anterior no las reconoció.
          </p>
        </div>
      </div>
      
      <p className="text-center text-[10px] text-slate-600 uppercase tracking-[0.2em]">
        ATM FIELD MASTER • MÓDULO DE DEPURACIÓN v1.0
      </p>
    </div>
  );
}

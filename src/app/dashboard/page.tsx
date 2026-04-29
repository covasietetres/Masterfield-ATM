'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bot, 
  Zap, 
  MapPin, 
  Radio, 
  FileText, 
  Clock, 
  ArrowRight,
  Shield,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserEmail(data.user.email || 'Ingeniero');
    });
  }, []);

  const quickActions = [
    { 
      name: 'DOLA Assistant', 
      desc: 'Consulta técnica conversacional', 
      href: '/dashboard/chat', 
      icon: Bot, 
      color: 'from-violet-600 to-indigo-600',
      shadow: 'shadow-violet-900/20'
    },
    { 
      name: 'Sites / Lugares', 
      desc: 'Ubicación de cajeros y rutas', 
      href: '/dashboard/sites', 
      icon: MapPin, 
      color: 'from-blue-600 to-cyan-600',
      shadow: 'shadow-blue-900/20'
    },
    { 
      name: 'Frecuencia Viva', 
      desc: 'Canal táctico de comunicación', 
      href: '/dashboard/team', 
      icon: Radio, 
      color: 'from-emerald-600 to-teal-600',
      shadow: 'shadow-emerald-900/20'
    },
    { 
      name: 'Biblioteca', 
      desc: 'Manuales y documentación', 
      href: '/dashboard/knowledge', 
      icon: FileText, 
      color: 'from-amber-600 to-orange-600',
      shadow: 'shadow-amber-900/20'
    }
  ];

  return (
    <div className="space-y-10 pb-20 animate-fade-in-up">
      {/* Hero Header */}
      <header className="relative p-8 md:p-12 rounded-[3rem] overflow-hidden glass-card">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
            <Activity className="w-3 h-3 animate-pulse" /> Sistema Operativo Activo
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none">
            Bienvenido, <span className="text-blue-500">{userEmail?.split('@')[0]}</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-lg max-w-xl font-medium leading-relaxed">
            Tu terminal de operaciones técnicas para NCR, Diebold y GRG está lista. ¿En qué podemos avanzar hoy?
          </p>
        </div>
      </header>

      {/* Quick Actions Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quickActions.map((action, idx) => (
          <motion.button
            key={action.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => router.push(action.href)}
            className="group relative flex items-center gap-6 p-8 rounded-[2.5rem] bg-slate-900/50 border border-slate-800 hover:border-white/20 transition-all text-left overflow-hidden shadow-2xl active:scale-95"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
            <div className={`p-5 rounded-[1.8rem] bg-gradient-to-br ${action.color} ${action.shadow} text-white group-hover:scale-110 transition-transform duration-500`}>
              <action.icon className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-1">{action.name}</h3>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{action.desc}</p>
            </div>
            <ArrowRight className="w-6 h-6 text-slate-700 group-hover:text-white transition-colors" />
          </motion.button>
        ))}
      </section>

      {/* Status & Recent Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Card */}
        <div className="lg:col-span-2 glass-card p-8 rounded-[2.5rem] space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
              <Clock className="w-4 h-4" /> Actividad Reciente
            </h3>
            <button className="text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300">Ver Historial</button>
          </div>
          <div className="space-y-4">
            {[1, 2].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">Consulta Error 012 NCR</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Hace 2 horas · Módulo Dispensador</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Stats Card */}
        <div className="glass-card p-8 rounded-[2.5rem] space-y-8 flex flex-col justify-between border-l-4 border-blue-600">
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
              <Shield className="w-4 h-4" /> Integridad de Red
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Supabase Engine</span>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[9px] font-black rounded border border-emerald-500/20">ONLINE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gemini API</span>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[9px] font-black rounded border border-emerald-500/20">READY</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sync Latency</span>
                <span className="text-xs font-black text-white">42ms</span>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-white/5">
            <p className="text-[9px] text-slate-600 uppercase font-bold tracking-[0.2em] leading-relaxed">
              Terminal Masterfield v2.4 · ATM Specialist Suite
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

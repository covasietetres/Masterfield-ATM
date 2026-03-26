'use client';

import { Activity, AlertTriangle, Cpu, Network } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white tracking-wider uppercase flex items-center gap-3">
          <Activity className="text-blue-500" />
          Terminal de Comando
        </h1>
        <p className="mt-2 text-slate-400 text-sm tracking-wide">
          ESTADO DEL SISTEMA: EN LÍNEA. ESPERANDO INSTRUCCIONES.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center text-center hover:border-blue-500/50 transition-colors group cursor-default">
          <div className="bg-blue-500/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <Network className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 uppercase tracking-wide">Sistemas NCR</h3>
          <p className="text-slate-500 text-sm mt-2">Protocolos de diagnóstico activos disponibles.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center text-center hover:border-amber-500/50 transition-colors group cursor-default">
          <div className="bg-amber-500/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <Cpu className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 uppercase tracking-wide">Diebold</h3>
          <p className="text-slate-500 text-sm mt-2">Interconexiones de hardware estables.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center text-center hover:border-emerald-500/50 transition-colors group cursor-default">
          <div className="bg-emerald-500/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <Activity className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 uppercase tracking-wide">GRG</h3>
          <p className="text-slate-500 text-sm mt-2">Módulos de dispensación verificados.</p>
        </div>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg mt-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="text-amber-500 w-6 h-6" />
          <h2 className="text-xl font-bold text-slate-200 uppercase tracking-wide">Alertas Recientes</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
            <div>
              <p className="text-white font-medium text-sm">Actualización de Sistema Requerida</p>
              <p className="text-slate-500 text-xs mt-1">NCRCore v2.4.1 pendiente de instalación.</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">10:42 AM</span>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
            <div>
              <p className="text-white font-medium text-sm">Rotación de Llave de Autenticación</p>
              <p className="text-slate-500 text-xs mt-1">ID de Ingeniero #4928 rotado con éxito.</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">08:15 AM</span>
          </div>
        </div>
      </section>
    </div>
  );
}

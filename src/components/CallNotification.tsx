'use client';

import { usePresence } from '@/contexts/PresenceContext';
import { PhoneIncoming, X, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function CallNotification() {
  const { incomingCall, setIncomingCall } = usePresence();
  const router = useRouter();

  if (!incomingCall) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-10 duration-300">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-2xl flex items-center gap-4 max-w-sm w-full backdrop-blur-md">
        <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center relative">
           <PhoneIncoming className="w-6 h-6 text-emerald-400 animate-bounce" />
           <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
        </div>
        
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Llamada de {incomingCall.senderName}</h4>
          <p className="text-[10px] text-slate-400 font-mono">FRECUENCIA DE INGENIEROS</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => {
              router.push('/dashboard/team');
              // No lo limpiamos aquí, dejamos que la página de Team lo maneje
            }}
            className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-colors shadow-lg"
            title="Ir a Frecuencia"
          >
            <Phone className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => setIncomingCall(null)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors"
            title="Ignorar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

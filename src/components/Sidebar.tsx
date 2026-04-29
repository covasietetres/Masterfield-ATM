'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Server, 
  Home, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  MessageSquare,
  Radio,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { name: 'Inicio', href: '/dashboard', icon: Home },
    { name: 'DOLA Assistant', href: '/dashboard/chat', icon: MessageSquare },
    { name: 'Sites / Lugares', href: '/dashboard/sites', icon: MapPin },
    { name: 'Vivo (Frecuencia)', href: '/dashboard/team', icon: Radio },
    { name: 'Biblioteca', href: '/dashboard/knowledge', icon: FileText },
    { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
  ];


  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 right-4 z-[60] p-3 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-600/40 focus:outline-none active:scale-90 transition-all"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <div
        className={`fixed inset-y-0 left-0 z-[50] w-72 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 transform transition-transform duration-500 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex flex-col items-center justify-center p-8 border-b border-slate-800/50 shrink-0">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse" />
            <div className="relative bg-gradient-to-br from-blue-500 to-cyan-600 p-4 rounded-3xl ring-1 ring-white/20 shadow-xl">
              <Server className="w-7 h-7 text-white" />
            </div>
          </div>
          <h2 className="text-white font-black tracking-[0.2em] text-xs uppercase" suppressHydrationWarning>ATM Field Master</h2>
          {userEmail && (
            <div className="mt-4 w-full px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5 backdrop-blur-sm">
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest text-center truncate">
                {userEmail}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-8 space-y-3 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-xs uppercase tracking-[0.1em] font-bold ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800/50">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 w-full px-4 py-4 text-[10px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-2xl transition-all uppercase tracking-[0.2em] font-black border border-rose-500/10"
          >
            <LogOut className="w-4 h-4" />
            Finalizar Turno
          </button>
        </div>
      </div>
      
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/90 z-[40] md:hidden backdrop-blur-md transition-opacity duration-500"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

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
    { name: 'Terminal', href: '/dashboard', icon: Home },
    { name: 'Consulta', href: '/dashboard/consulta', icon: MessageSquare },
    { name: 'Frecuencia (En Vivo)', href: '/dashboard/team', icon: Radio },
    { name: 'Base de Conocimientos', href: '/dashboard/knowledge', icon: FileText },
    { name: 'Sitios Técnicos', href: '/dashboard/sites', icon: MapPin },
    { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-3 right-3 z-[60] p-2.5 bg-slate-800/95 backdrop-blur-sm border border-slate-700/80 rounded-xl text-slate-300 hover:text-white shadow-xl focus:outline-none"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <div
        className={`fixed inset-y-0 left-0 z-[50] w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex flex-col items-center justify-center p-6 border-b border-slate-800 shrink-0 min-h-[140px]">
          <div className="bg-blue-500/10 p-3 rounded-full mb-3 ring-1 ring-blue-500/30">
            <Server className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-white font-bold tracking-widest text-sm uppercase" suppressHydrationWarning>ATM Field Master</h2>
          {userEmail && (
            <p className="mt-2 text-xs text-slate-400 max-w-full truncate px-2 font-mono bg-slate-800/50 rounded py-1 border border-slate-700/50" title={userEmail}>
              {userEmail}
            </p>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm uppercase tracking-wide font-medium ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors uppercase tracking-wide font-medium"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 z-[40] md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

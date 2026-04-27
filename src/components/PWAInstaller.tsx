'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Download, Share, PlusSquare, X } from 'lucide-react';

export default function PWAInstaller() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Detect if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Handle Android/Chrome prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!isStandalone) setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS and not standalone, show prompt after a short delay
    if (isIOSDevice && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setShowPrompt(false);
    }
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="bg-slate-800 border border-blue-500/30 rounded-2xl p-4 shadow-2xl shadow-blue-500/20 backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="bg-blue-600/20 p-3 rounded-xl">
              <Smartphone className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-slate-100 font-bold text-sm uppercase tracking-wider">
                Instalar Acceso Directo
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                {isIOS 
                  ? 'Añade ATM Field Master a tu pantalla de inicio para acceso rápido.' 
                  : 'Instala la aplicación para una mejor experiencia técnica.'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowPrompt(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          {isIOS ? (
            <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 text-xs text-slate-300">
              <span>Pulsa</span>
              <Share className="w-4 h-4 text-blue-400" />
              <span>luego</span>
              <PlusSquare className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-slate-100">"Añadir a pantalla de inicio"</span>
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Download className="w-4 h-4" />
              INSTALAR AHORA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

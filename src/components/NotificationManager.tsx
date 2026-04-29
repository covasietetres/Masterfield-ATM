'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if notifications are supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }

    // Wake Lock Implementation
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock is active');
        }
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    requestWakeLock();

    // BeforeUnload to prevent accidental closing
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'La aplicación debe permanecer abierta para recibir alertas críticas. ¿Estás seguro de salir?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Re-request wake lock if tab becomes visible again
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // We use a public VAPID key (Placeholder, user should replace with their own)
        // For testing, I'll use a standard one or suggest generating one.
        const vapidPublicKey = 'BEl62iC7969_9mO9uF-X1pMTt-A3xM1kLAn3z.X.X.X'; // Placeholder
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey
        });
      }

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            subscription: subscription.toJSON()
          });
        console.log('Push subscription saved to Supabase');
      }
    } catch (err) {
      console.error('Error subscribing to push:', err);
    }
  };

  const requestPermission = async () => {
    if (!isSupported) return;
    
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      await subscribeToPush();
      console.log('Notification permission granted and subscribed.');
    }
  };

  if (!isSupported) return null;

  return (
    <>
      {permission === 'default' && (
        <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-xl shadow-2xl z-[9999] flex flex-col gap-2 animate-bounce">
          <p className="text-sm font-bold text-center">
            ⚠️ ¡Atención! Activa las notificaciones para recibir alertas técnicas en segundo plano.
          </p>
          <button 
            onClick={requestPermission}
            className="bg-white text-blue-600 font-bold py-2 px-4 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Activar Alertas
          </button>
        </div>
      )}
    </>
  );
}

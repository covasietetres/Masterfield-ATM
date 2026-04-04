'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function PresenceTracker() {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let activeChannel: RealtimeChannel;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const email = user.email || 'Ingeniero Desconocido';
      const shortName = email.split('@')[0];

      activeChannel = supabase.channel('engineering-frequency', {
        config: {
          broadcast: { self: false },
          presence: { key: shortName }
        }
      });

      channelRef.current = activeChannel;

      // Event listener for bipper (global alert)
      activeChannel.on('broadcast', { event: 'bipper' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === 'ALL' || p.targetUser === shortName) {
           playBipperSound();
        }
      });

      activeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          activeChannel.track({ 
            online_at: new Date().toISOString(),
            status: 'online'
          });
        }
      });
    };

    const playBipperSound = () => {
       try {
         const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
         const oscillator = audioCtx.createOscillator();
         const gainNode = audioCtx.createGain();

         oscillator.type = 'sine';
         oscillator.frequency.setValueAtTime(950, audioCtx.currentTime);
         oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);

         gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
         gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

         oscillator.connect(gainNode);
         gainNode.connect(audioCtx.destination);

         oscillator.start();
         oscillator.stop(audioCtx.currentTime + 0.25);
       } catch (e) {
         console.error("Audio error:", e);
       }
     };

    initPresence();

    return () => {
      if (activeChannel) {
        activeChannel.untrack();
        supabase.removeChannel(activeChannel);
      }
    };
  }, []);

  return null; // This component doesn't render anything
}

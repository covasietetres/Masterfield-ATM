'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceContextType {
  onlineUsers: string[];
  isConnected: boolean;
  channel: RealtimeChannel | null;
  userEmail: string;
  incomingCall: { senderName: string; offer: any } | null;
  setIncomingCall: (call: { senderName: string; offer: any } | null) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('Ingeniero');
  const [incomingCall, setIncomingCall] = useState<{ senderName: string; offer: any } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let activeChannel: RealtimeChannel;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const email = user.email || 'Ingeniero Desconocido';
      const shortName = email.split('@')[0];
      setUserEmail(shortName);

      activeChannel = supabase.channel('engineering-frequency', {
        config: {
          broadcast: { self: false },
          presence: { key: shortName }
        }
      });

      channelRef.current = activeChannel;

      // Global Bipper Alert
      activeChannel.on('broadcast', { event: 'bipper' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === 'ALL' || p.targetUser === shortName) {
           playBipperSound();
        }
      });

      // Signaling for calls
      activeChannel.on('broadcast', { event: 'call_offer' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === shortName) {
           setIncomingCall({ senderName: p.senderName, offer: p.offer });
        }
      });

      activeChannel.on('presence', { event: 'sync' }, () => {
        const state = activeChannel.presenceState();
        const users = Object.keys(state);
        const otherUsers = users.filter(u => u !== shortName);
        setOnlineUsers(otherUsers);
      });

      activeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          activeChannel.track({ 
            online_at: new Date().toISOString(),
            status: 'online'
          });
        } else {
          setIsConnected(false);
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

  return (
    <PresenceContext.Provider value={{ 
      onlineUsers, 
      isConnected, 
      channel: channelRef.current, 
      userEmail,
      incomingCall,
      setIncomingCall
    }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}

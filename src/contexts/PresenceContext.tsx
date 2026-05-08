'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  senderName: string;
  text?: string;
  audioData?: string;
  type: 'text' | 'audio';
  targetUser: string;
  timestamp: Date;
  isSelf: boolean;
}

interface PresenceContextType {
  onlineUsers: string[];
  isConnected: boolean;
  channel: RealtimeChannel | null;
  userEmail: string;
  messages: ChatMessage[];
  addLocalMessage: (msg: ChatMessage) => void;
  incomingCall: { senderName: string; offer: any } | null;
  setIncomingCall: (call: { senderName: string; offer: any } | null) => void;
  onCallSignal: (callback: (event: string, payload: any) => void) => () => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('Ingeniero');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [incomingCall, setIncomingCall] = useState<{ senderName: string; offer: any } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const signalCallbacks = useRef<((event: string, payload: any) => void)[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const onCallSignal = (callback: (event: string, payload: any) => void) => {
    signalCallbacks.current.push(callback);
    return () => {
      signalCallbacks.current = signalCallbacks.current.filter(cb => cb !== callback);
    };
  };

  useEffect(() => {
    // Initialize AudioContext on first user interaction if possible
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && audioCtxRef.current) {
        audioCtxRef.current.resume();
      }
    });

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const addLocalMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

  useEffect(() => {
    let activeChannel: RealtimeChannel;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const email = user.email || 'Ingeniero Desconocido';
      
      // Fetch full name from engineers table to sync with UI
      const { data: engData } = await supabase
        .from('engineers')
        .select('name')
        .eq('is_active', true)
        .ilike('name', `%${email.split('@')[0]}%`) // Fallback search or we could assume email field exists
        .single();

      // If we found a name in the DB, use it, otherwise use email prefix
      const displayName = engData?.name || email.split('@')[0];
      setUserEmail(displayName);

      activeChannel = supabase.channel('engineering-frequency', {
        config: {
          broadcast: { self: false },
          presence: { key: displayName }
        }
      });

      channelRef.current = activeChannel;

      // Global Bipper Alert
      activeChannel.on('broadcast', { event: 'bipper' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === 'ALL' || p.targetUser === displayName) {
           playNotificationSound(p.senderName);
        }
      });

      // Signaling Switchboard (Centralized)
      activeChannel.on('broadcast', { event: 'call_offer' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === displayName) {
           playNotificationSound();
           setIncomingCall({ senderName: p.senderName, offer: p.offer });
           signalCallbacks.current.forEach(cb => cb('call_offer', p));
        }
      });

      activeChannel.on('broadcast', { event: 'call_answer' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === displayName) {
           signalCallbacks.current.forEach(cb => cb('call_answer', p));
        }
      });

      activeChannel.on('broadcast', { event: 'call_ice_candidate' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === displayName) {
           signalCallbacks.current.forEach(cb => cb('call_ice_candidate', p));
        }
      });

      activeChannel.on('broadcast', { event: 'call_hangup' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === displayName) {
           signalCallbacks.current.forEach(cb => cb('call_hangup', p));
        }
      });

      // Global Message Listener (Unified)
      activeChannel.on('broadcast', { event: 'new_message' }, (payload) => {
        const p = payload.payload;
        
        // Privacy Filter
        if (p.targetUser && p.targetUser !== 'ALL') {
          if (p.targetUser !== displayName && p.senderName !== displayName) {
            return; 
          }
        }

        // Play sound if message is not from self
        if (p.senderName !== displayName) {
          playNotificationSound(p.senderName);
        }

        const newMessage: ChatMessage = {
          id: Math.random().toString(36).substring(7),
          senderName: p.senderName,
          text: p.text,
          audioData: p.audioData,
          type: p.type || 'text',
          targetUser: p.targetUser || 'ALL',
          timestamp: new Date(p.timestamp),
          isSelf: false
        };
        setMessages((prev) => [...prev, newMessage]);
      });

      activeChannel.on('presence', { event: 'sync' }, () => {
        const state = activeChannel.presenceState();
        const users = Object.keys(state);
        const otherUsers = users.filter(u => u !== displayName);
        setOnlineUsers(otherUsers);
      });

      activeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          activeChannel.track({ 
            online_at: new Date().toISOString(),
            status: 'online'
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });
    };

     const playNotificationSound = (senderName?: string) => {
        try {
          // 1. System Notification (Always try this for background/minimized)
          if (Notification.permission === 'granted') {
            const notification = new Notification('🚨 ALERTA CRÍTICA', {
              body: `${senderName || 'Un ingeniero'} te está enviando un BIP de alerta.`,
              icon: '/icon.png',
              tag: 'bip-alert',
            });
            
            // Interaction to help audio context
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          }

          // 2. Procedural Audio
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          
          const audioCtx = audioCtxRef.current;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }

          const playTone = (freq: number, start: number, duration: number) => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
            gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime + start);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start(audioCtx.currentTime + start);
            oscillator.stop(audioCtx.currentTime + start + duration);
          };

          // Aggressive cell phone style "ding-ding" (A5 to C6) repeated
          for (let i = 0; i < 3; i++) {
            const offset = i * 0.4;
            playTone(880, offset, 0.1);
            playTone(1046, offset + 0.12, 0.25);
          }

          // 3. Vibration
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
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
      messages,
      addLocalMessage,
      incomingCall,
      setIncomingCall,
      onCallSignal
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

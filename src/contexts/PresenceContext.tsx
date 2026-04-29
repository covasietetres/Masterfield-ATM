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

  const onCallSignal = (callback: (event: string, payload: any) => void) => {
    signalCallbacks.current.push(callback);
    return () => {
      signalCallbacks.current = signalCallbacks.current.filter(cb => cb !== callback);
    };
  };

  const addLocalMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

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
           playNotificationSound(p.senderName);
        }
      });

      // Signaling Switchboard (Centralized)
      activeChannel.on('broadcast', { event: 'call_offer' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === shortName) {
           playNotificationSound();
           setIncomingCall({ senderName: p.senderName, offer: p.offer });
           signalCallbacks.current.forEach(cb => cb('call_offer', p));
        }
      });

      activeChannel.on('broadcast', { event: 'call_answer' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === shortName) {
           signalCallbacks.current.forEach(cb => cb('call_answer', p));
        }
      });

      activeChannel.on('broadcast', { event: 'call_ice_candidate' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === shortName) {
           signalCallbacks.current.forEach(cb => cb('call_ice_candidate', p));
        }
      });

      activeChannel.on('broadcast', { event: 'call_hangup' }, (payload) => {
        const p = payload.payload;
        if (p.targetUser === shortName) {
           signalCallbacks.current.forEach(cb => cb('call_hangup', p));
        }
      });

      // Global Message Listener (Unified)
      activeChannel.on('broadcast', { event: 'new_message' }, (payload) => {
        const p = payload.payload;
        
        // Privacy Filter
        if (p.targetUser && p.targetUser !== 'ALL') {
          if (p.targetUser !== shortName && p.senderName !== shortName) {
            return; 
          }
        }

        // Play sound if message is not from self
        if (p.senderName !== shortName) {
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
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });
    };

    const playNotificationSound = (senderName?: string) => {
       try {
         // Show system notification if in background
         if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
           new Notification('🚨 ALERTA CRÍTICA', {
             body: `${senderName || 'Un ingeniero'} te está enviando un BIP de alerta.`,
             icon: '/icon.png'
           });
         }

         const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
         const playTone = (freq: number, start: number, duration: number) => {
           const oscillator = audioCtx.createOscillator();
           const gainNode = audioCtx.createGain();
           oscillator.type = 'sine';
           oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
           gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime + start);
           gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
           oscillator.connect(gainNode);
           gainNode.connect(audioCtx.destination);
           oscillator.start(audioCtx.currentTime + start);
           oscillator.stop(audioCtx.currentTime + start + duration);
         };

         // Cell phone style "ding-ding" (A5 to C6)
         playTone(880, 0, 0.1);
         playTone(1046, 0.12, 0.25);
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

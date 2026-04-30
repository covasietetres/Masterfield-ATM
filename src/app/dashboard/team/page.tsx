'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Users, 
  Send, 
  Mic, 
  MessageSquare, 
  Shield, 
  Trash2, 
  Radio, 
  Volume2, 
  PhoneCall, 
  PhoneOff, 
  User,
  Zap,
  X
} from 'lucide-react';
import { usePresence, ChatMessage } from '@/contexts/PresenceContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function TeamChatPage() {
  const { onlineUsers, isConnected, channel, userEmail, incomingCall, setIncomingCall, messages, addLocalMessage, onCallSignal } = usePresence();
  
  const {
    callStatus,
    currentPeer,
    makeCall,
    acceptCall,
    hangUp,
    remoteStream
  } = useWebRTC({ channel, userEmail, onCallSignal });

  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');
  const [targetUser, setTargetUser] = useState('ALL');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [allEngineers, setAllEngineers] = useState<{name: string, isOnline: boolean}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchEngineers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('engineers')
        .select('name')
        .eq('is_active', true);
      
      if (!error && data) {
        const engineersList = data.map(eng => ({
          name: eng.name,
          isOnline: onlineUsers.includes(eng.name)
        }));
        setAllEngineers(engineersList);
      }
      setIsLoading(false);
    };

    fetchEngineers();
  }, [onlineUsers]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Vincular audio remoto
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      audioRef.current.srcObject = remoteStream;
      // En iOS Safari, a veces hay que silenciar y volver a activar para que el autoplay funcione
      audioRef.current.play().catch(e => {
        console.error("Error auto-playing remote audio:", e);
        // Reintentar si falla por política de autoplato
      });
    }
  }, [remoteStream]);

  const sendMessage = async () => {
    if (!inputText.trim() || !channel) return;

    const msgData = {
      senderName: userEmail,
      text: inputText,
      targetUser,
      type: 'text',
      timestamp: new Date().toISOString()
    };

    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: msgData
    });

    addLocalMessage({
      ...msgData,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      isSelf: true
    } as ChatMessage);

    setInputText('');
  };

  // Recording Timer / Visual Feedback
  const [recordDuration, setRecordDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Detectar iOS para preferir mp4
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Determine supported mime type
      let mimeType = 'audio/webm;codecs=opus';
      if (isIOS) {
        mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/mpeg';
      } else if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          
          if (channel) {
            const msgData = {
              senderName: userEmail,
              audioData: base64Audio,
              targetUser,
              type: 'audio',
              timestamp: new Date().toISOString()
            };

            await channel.send({
              type: 'broadcast',
              event: 'new_message',
              payload: msgData
            });

            addLocalMessage({
              ...msgData,
              id: Math.random().toString(36).substring(7),
              timestamp: new Date(),
              isSelf: true
            } as ChatMessage);
          }
        };
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

      // Haptic feedback if available
      if ('vibrate' in navigator) navigator.vibrate(50);
      
    } catch (err) {
      console.error("Error al grabar:", err);
      alert("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if ('vibrate' in navigator) navigator.vibrate(20);
    }
  };

  // Ringing Sound Logic
  useEffect(() => {
    let ringInterval: NodeJS.Timeout | null = null;
    
    if (callStatus === 'calling' || callStatus === 'incoming') {
      const playRing = async () => {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const playTone = (freq: number, start: number, duration: number) => {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + start);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start(audioCtx.currentTime + start);
          oscillator.stop(audioCtx.currentTime + start + duration);
        };
        
        // Double pulse "Rinnng-Rinnng"
        playTone(440, 0, 0.4);
        playTone(480, 0, 0.4);
        playTone(440, 0.6, 0.4);
        playTone(480, 0.6, 0.4);
      };

      playRing();
      ringInterval = setInterval(playRing, 2500);
    }

    return () => {
      if (ringInterval) clearInterval(ringInterval);
    };
  }, [callStatus]);

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] md:h-[calc(100vh-120px)] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="bg-slate-900/80 p-4 md:p-6 border-b border-slate-800 flex items-center justify-between backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm md:text-xl font-black text-white tracking-tighter md:tracking-tight uppercase">
              Frecuencia Táctica
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[9px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">
                {isConnected ? 'Enlace Activo' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-white border border-slate-700/50 active:scale-90 transition-all"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Messages List */}
        <div className="flex-1 flex flex-col bg-slate-950/50 relative">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth pb-32 md:pb-8 custom-scrollbar"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-slate-400 gap-6">
                <div className="p-8 rounded-full bg-slate-900 border border-slate-800">
                  <Zap className="w-12 h-12 text-blue-500" />
                </div>
                <p className="text-[10px] font-black tracking-[0.4em] uppercase text-center max-w-[200px] leading-relaxed">Sincronizando canal de voz...</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[70%] rounded-3xl p-4 md:p-5 shadow-2xl relative group ${
                    msg.isSelf 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none'
                  }`}>
                    <div className={`flex items-center gap-2 mb-2 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-60">
                        {msg.senderName}
                      </span>
                      <span className="text-[8px] opacity-40 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.type === 'text' ? (
                      <p className="text-xs md:text-sm leading-relaxed font-medium">{msg.text}</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl border border-white/5">
                          <div className="p-3 bg-white/10 rounded-xl">
                            <Volume2 className="w-4 h-4 text-white" />
                          </div>
                          <audio src={msg.audioData} controls className="h-8 w-full md:w-48 custom-audio invert" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-40 italic">Transmisión de Voz</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Unified Controls Bar (MOBILE & DESKTOP) */}
          <div className="p-4 md:p-6 bg-slate-900/95 border-t border-slate-800 backdrop-blur-2xl z-20">
            {/* Context/Target Selector */}
            <div className="flex items-center gap-4 mb-3 md:mb-4 px-1">
              <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <Shield className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
                <span className="hidden sm:inline">Transmitir a:</span>
                <span className="sm:hidden">Red:</span>
              </div>
              <select 
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-blue-400 text-[9px] md:text-[10px] font-black rounded-full md:rounded-xl px-4 py-1.5 md:py-2 outline-none focus:border-blue-500 transition-all cursor-pointer uppercase tracking-widest appearance-none sm:appearance-auto"
              >
                <option value="ALL">Canal: [ Público ]</option>
                {allEngineers.map(eng => (
                  <option key={eng.name} value={eng.name}>
                    {eng.isOnline ? '🟢' : '⚪'} {eng.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* PTT Button */}
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                className={`p-4 md:p-5 rounded-2xl md:rounded-2xl transition-all shadow-2xl flex-shrink-0 border-2 relative ${
                  isRecording 
                    ? 'bg-rose-600 border-rose-400 text-white scale-95 animate-pulse shadow-rose-600/40' 
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 active:scale-95'
                }`}
                title="Mantener para enviar voz (PTT)"
              >
                {isRecording ? <Zap className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
                {isRecording && (
                  <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-rose-600 text-[10px] font-black px-3 py-1 rounded-full shadow-xl border border-rose-400 animate-bounce">
                    {recordDuration}s
                  </span>
                )}
              </button>

              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Inyectar mensaje..."
                  className="w-full bg-slate-950 text-white rounded-2xl px-5 md:px-6 py-4 md:py-5 text-sm outline-none border border-slate-800 focus:border-blue-500 transition-all placeholder:text-slate-700 shadow-inner"
                />
              </div>

              <button
                onClick={sendMessage}
                disabled={!inputText.trim()}
                className="p-4 md:p-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl transition-all shadow-2xl shadow-blue-900/40 active:scale-90 flex-shrink-0"
              >
                <Send className="w-6 h-6" />
              </button>

              <button
                onClick={async () => {
                  if (!channel) return;
                  
                  // 1. Send broadcast for those who ARE online
                  await channel.send({
                    type: 'broadcast',
                    event: 'bipper',
                    payload: { targetUser, senderName: userEmail }
                  });

                  // 2. Record in DB to trigger background Push Notifications for those who ARE NOT online
                  const { error } = await supabase
                    .from('critical_alerts')
                    .insert({
                      sender_name: userEmail,
                      target_user: targetUser,
                      type: 'bipper',
                      status: 'pending'
                    });

                  if (error) console.error('Error saving critical alert:', error);

                  // Local feedback
                  if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
                  alert('¡Alerta de Bipper enviada a ' + targetUser + ' (incluyendo desconectados)!');
                }}
                className="p-4 md:p-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl transition-all shadow-2xl shadow-rose-900/40 active:scale-90 flex-shrink-0 border-2 border-rose-400/50"
                title="Enviar Alerta Crítica (Bipper)"
              >
                <Zap className="w-6 h-6 fill-current" />
              </button>
            </div>
            
            {/* Mobile PTT Label */}
            <p className="md:hidden text-center text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] mt-3">
              {isRecording ? 'Transmitiendo Voz...' : 'Botón Mic: Mantener para Hablar'}
            </p>
          </div>
        </div>

        {/* Sidebar: Online Users (OVERLAY ON MOBILE) */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed md:hidden inset-0 z-40 bg-slate-950/95 backdrop-blur-xl p-8 pt-24"
            >
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="absolute top-8 right-8 p-3 bg-slate-800 rounded-2xl text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-10 flex items-center gap-4">
                <Users className="w-5 h-5 text-blue-500" />
                Personal Registrado
              </h2>

              <div className="space-y-4">
                {isLoading ? (
                  <div className="p-10 rounded-3xl border-2 border-dashed border-slate-800 text-center">
                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest animate-pulse">Sincronizando personal...</p>
                  </div>
                ) : allEngineers.length === 0 ? (
                  <div className="p-10 rounded-3xl border-2 border-dashed border-slate-800 text-center">
                    <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest">No hay personal registrado</p>
                    <p className="text-[8px] text-slate-600 mt-2">Asegúrate de que los ingenieros estén en la base de datos.</p>
                  </div>
                ) : (
                  allEngineers.map((eng) => (
                    <div 
                      key={eng.name}
                      className="flex items-center justify-between p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${eng.isOnline ? 'bg-blue-600 shadow-blue-600/20' : 'bg-slate-800'}`}>
                          <User className={`w-6 h-6 ${eng.isOnline ? 'text-white' : 'text-slate-500'}`} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white uppercase tracking-tighter">
                            {eng.name}
                          </span>
                          <span className={`text-[8px] font-bold uppercase tracking-widest ${eng.isOnline ? 'text-emerald-500' : 'text-slate-600'}`}>
                            {eng.isOnline ? 'Enlace Activo' : 'Fuera de Línea'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => { if (eng.isOnline) { makeCall(eng.name); setIsSidebarOpen(false); } else { alert('El ingeniero está fuera de línea. Se le enviará una notificación.'); } }}
                        className={`p-4 rounded-2xl shadow-lg active:scale-90 transition-all ${eng.isOnline ? 'bg-emerald-600 text-white shadow-emerald-900/40' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                      >
                        <PhoneCall className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar for Desktop */}
        <div className="hidden md:block w-80 bg-slate-900/30 border-l border-slate-800 p-6 overflow-y-auto custom-scrollbar">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
            <Users className="w-4 h-4" />
            Personal Registrado
          </h2>
          <div className="space-y-3">
            {isLoading ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-800 text-center">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest animate-pulse">Sincronizando...</p>
              </div>
            ) : allEngineers.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-800 text-center">
                <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest leading-loose">No hay personal registrado en el sistema.</p>
              </div>
            ) : (
              allEngineers.map((eng) => (
                <div 
                  key={eng.name}
                  className="group flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-900 hover:border-blue-500/50 transition-all shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${eng.isOnline ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20' : 'bg-slate-800 border-slate-700'}`}>
                      <User className={`w-5 h-5 ${eng.isOnline ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-black transition-colors uppercase tracking-tight ${eng.isOnline ? 'text-white' : 'text-slate-400'}`}>
                        {eng.name}
                      </span>
                      <span className={`text-[7px] font-bold uppercase tracking-widest ${eng.isOnline ? 'text-emerald-500' : 'text-slate-600'}`}>
                        {eng.isOnline ? 'Enlace' : 'Desconectado'}
                      </span>
                    </div>
                  </div>
                  {eng.isOnline && (
                    <button 
                      onClick={() => makeCall(eng.name)}
                      className="p-3 text-slate-500 hover:text-emerald-400 bg-slate-950 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 shadow-xl"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Audio Remoto Oculto */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Call Overlay (Visualizer style) */}
      <AnimatePresence>
        {callStatus !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-blue-600 blur-3xl opacity-20 animate-pulse rounded-full" />
              <div className="w-40 h-40 rounded-full bg-slate-900 border-4 border-blue-600/30 flex items-center justify-center relative z-10 shadow-2xl">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-inner">
                  <User className="w-16 h-16 text-white" />
                </div>
              </div>
              {callStatus === 'connected' && (
                <div className="absolute -top-4 -right-4 bg-emerald-500 p-4 rounded-3xl animate-bounce shadow-2xl border-4 border-slate-950">
                  <Volume2 className="w-6 h-6 text-white" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{currentPeer}</h2>
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-1 h-4 bg-blue-500 rounded-full animate-wave-${i}`} />
                  ))}
                </div>
                <p className="text-blue-400 font-black tracking-[0.5em] text-[10px] uppercase animate-pulse">
                  {callStatus === 'calling' ? 'Estableciendo Enlace...' : 
                   callStatus === 'incoming' ? 'Solicitud de Conexión' : 
                   callStatus === 'connected' ? 'Comunicación Segura' : ''}
                </p>
              </div>
            </div>

            <div className="mt-16 flex gap-10">
              {callStatus === 'incoming' && (
                <button
                  onClick={async () => {
                    // Resumir AudioContext si existe en el window para iOS
                    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioCtx) {
                      const ctx = new AudioCtx();
                      if (ctx.state === 'suspended') await ctx.resume();
                    }
                    acceptCall();
                  }}
                  className="w-20 h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-900/40 hover:scale-110 active:scale-95 transition-all"
                >
                  <PhoneCall className="w-10 h-10" />
                </button>
              )}
              <button
                onClick={hangUp}
                className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-2xl shadow-rose-900/40 hover:scale-110 active:scale-95 transition-all"
              >
                <PhoneOff className="w-10 h-10" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

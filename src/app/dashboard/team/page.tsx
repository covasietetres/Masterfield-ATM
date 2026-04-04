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
  Zap
} from 'lucide-react';
import { usePresence, ChatMessage } from '@/contexts/PresenceContext';
import { useWebRTC } from '@/hooks/useWebRTC';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      audioRef.current.play().catch(e => console.error("Error auto-playing remote audio:", e));
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
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
    } catch (err) {
      console.error("Error al grabar:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="bg-slate-900/50 p-4 border-b border-slate-800 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Radio className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              FRECUENCIA DE INGENIEROS
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Shield className="w-3 h-3 text-orange-500" />
              Canal táctico efímero con soporte para transmisiones cifradas (privadas).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className={`px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-medium flex items-center gap-1 md:gap-2 ${
            isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <span className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="hidden sm:inline">{isConnected ? 'TRANSMITIENDO' : 'SIN SEÑAL'}</span>
            <span className="sm:hidden">{isConnected ? 'ON' : 'OFF'}</span>
          </div>

          {/* Mobile Sidebar Toggle */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Messages List */}
        <div className="flex-1 flex flex-col bg-slate-950/50">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-slate-400 gap-4">
                <Zap className="w-12 h-12" />
                <p className="text-sm font-medium tracking-widest uppercase">Esperando transmisiones...</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 shadow-lg ${
                    msg.isSelf 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {msg.senderName}
                      </span>
                      <span className="text-[10px] opacity-50">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.type === 'text' ? (
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    ) : (
                      <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                        <div className="p-2 bg-white/10 rounded-full">
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <audio src={msg.audioData} controls className="h-8 w-48 custom-audio" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Controls Bar */}
          <div className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <Shield className="w-3 h-3 text-blue-400" />
                Transmitir a:
              </div>
              <select 
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="bg-slate-800 border-none text-blue-400 text-xs font-bold rounded-lg px-2 py-1 outline-none ring-1 ring-white/5 focus:ring-blue-500/50 transition-all cursor-pointer"
              >
                <option value="ALL uppercase">[ Todos (Público) ]</option>
                {onlineUsers.map(user => (
                  <option key={user} value={user}>[ PRIVADO: {user} ]</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`p-4 rounded-xl transition-all shadow-xl flex-shrink-0 ${
                  isRecording 
                    ? 'bg-red-500 text-white scale-95 animate-pulse shadow-red-500/20' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Mic className="w-5 h-5" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Escribe un mensaje de difusión..."
                  className="w-full bg-slate-950 text-slate-100 rounded-xl px-5 py-4 text-sm outline-none border border-slate-800 focus:border-blue-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                />
              </div>

              <button
                onClick={sendMessage}
                className="p-4 bg-blue-600 hover:bg-blue-50 rounded-xl text-white hover:text-blue-600 transition-all shadow-xl shadow-blue-600/10 group active:scale-95"
              >
                <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Online Users */}
        <div className={`
          fixed md:relative inset-y-0 right-0 z-40
          w-72 bg-slate-900 md:bg-slate-900/30 border-l border-slate-800 p-4 
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          hide-scrollbar
        `}>
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Users className="w-3 h-3" />
              Unidades en Línea
            </h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1 text-slate-500 hover:text-white"
            >
              <Trash2 className="w-4 h-4 rotate-45" /> {/* Close icon alternative */}
            </button>
          </div>
          <div className="space-y-2">
            {onlineUsers.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center">
                <p className="text-[10px] text-slate-600 font-bold uppercase">No hay otras unidades</p>
              </div>
            ) : (
              onlineUsers.map((user) => (
                <div 
                  key={user}
                  className="group flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-white/10 group-hover:from-blue-600 group-hover:to-blue-700 transition-all">
                      <User className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors capitalize">
                      {user}
                    </span>
                  </div>
                  <button 
                    onClick={() => makeCall(user)}
                    className="p-2 text-slate-500 hover:text-green-400 bg-slate-900/50 rounded-lg border border-white/5 hover:border-green-400/30 transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                    title="Iniciar llamada de voz"
                  >
                    <PhoneCall className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Audio Remoto Oculto */}
      <audio ref={audioRef} autoPlay />

      {/* Call Overlay */}
      {callStatus !== 'idle' && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse">
              <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-600/50">
                <User className="w-12 h-12 text-white" />
              </div>
            </div>
            {callStatus === 'connected' && (
              <div className="absolute -top-2 -right-2 bg-green-500 p-2 rounded-full animate-bounce border-4 border-slate-950">
                <Volume2 className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          <div className="mt-8 text-center space-y-2">
            <h2 className="text-2xl font-bold text-white capitalize">{currentPeer}</h2>
            <p className="text-blue-400 font-bold tracking-[0.3em] text-xs uppercase animate-pulse">
              {callStatus === 'calling' ? 'Llamando...' : 
               callStatus === 'incoming' ? 'Llamada Entrante' : 
               callStatus === 'connected' ? 'Enlace Establecido' : ''}
            </p>
          </div>

          <div className="mt-12 flex gap-8">
            {callStatus === 'incoming' && (
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-white shadow-2xl shadow-green-600/20 hover:scale-110 active:scale-95 transition-all"
              >
                <PhoneCall className="w-8 h-8" />
              </button>
            )}
            <button
              onClick={hangUp}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-2xl shadow-red-600/20 hover:scale-110 active:scale-95 transition-all"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

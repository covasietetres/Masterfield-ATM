'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Radio, Send, ShieldAlert, Users, Zap, Mic, Square, Lock, Bell, Phone, PhoneOff, PhoneIncoming, Volume2 } from 'lucide-react';
import { usePresence } from '@/contexts/PresenceContext';
import { useWebRTC } from '@/hooks/useWebRTC';

interface ChatMessage {
  id: string;
  senderName: string;
  text?: string;
  audioData?: string;
  type: 'text' | 'audio';
  targetUser: string; // 'ALL' o el email del usuario específico
  timestamp: Date;
  isSelf: boolean;
}

export default function TeamChatPage() {
  const { onlineUsers, isConnected, channel, userEmail, incomingCall, setIncomingCall } = usePresence();
  
  const {
    callStatus,
    currentPeer,
    makeCall,
    acceptCall,
    hangUp,
    handleOffer,
    handleAnswer,
    handleCandidate,
    remoteStream
  } = useWebRTC({ channel, userEmail });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetUser, setTargetUser] = useState<string>('ALL');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!channel || !isConnected) return;

    const handleNewMessage = (payload: any) => {
      const p = payload.payload;
      
      // FILTRO CIFRADO: Ignorar si es privado y NO soy ni el objetivo ni el remitente original
      if (p.targetUser && p.targetUser !== 'ALL') {
        if (p.targetUser !== userEmail && p.senderName !== userEmail) {
          return; // Desechar el paquete, no es para ti.
        }
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
    };

    channel.on('broadcast', { event: 'new_message' }, handleNewMessage);

    // Signaling listeners for existing call
    const handleSlingalingEvents = (payload: any) => {
       const p = payload.payload;
       if (p.targetUser !== userEmail) return;

       if (payload.event === 'call_offer') {
          // If we're already on this page, the Context will show the incoming call state
          // but we might want to trigger the hook's handleOffer too
       } else if (payload.event === 'call_answer') {
          handleAnswer(p);
       } else if (payload.event === 'call_ice_candidate') {
          handleCandidate(p);
       } else if (payload.event === 'call_hangup') {
          hangUp();
       }
    };

    channel.on('broadcast', { event: 'call_offer' }, (p) => {
      if (p.payload.targetUser === userEmail) {
         handleOffer(p.payload);
      }
    });
    channel.on('broadcast', { event: 'call_answer' }, (p) => p.payload.targetUser === userEmail && handleAnswer(p.payload));
    channel.on('broadcast', { event: 'call_ice_candidate' }, (p) => p.payload.targetUser === userEmail && handleCandidate(p.payload));
    channel.on('broadcast', { event: 'call_hangup' }, (p) => p.payload.targetUser === userEmail && hangUp());

    return () => {
    };
  }, [channel, isConnected, userEmail, handleAnswer, handleCandidate, handleOffer, hangUp]);

  const handleSendBipper = async (target?: string) => {
    if (!channel || !isConnected) return;
    const dest = target || targetUser;
    
    await channel.send({
      type: 'broadcast',
      event: 'bipper',
      payload: {
        senderName: userEmail,
        targetUser: dest,
        timestamp: new Date().toISOString()
      }
    });

    // Feedback visual opcional o sonido local
    console.log(`[BIPPER] Enviado a ${dest}`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !channel || !isConnected || isRecording) return;

    const time = new Date();
    
    // Add to local state (I always see what I send)
    const myMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      senderName: userEmail,
      text: inputText,
      type: 'text',
      targetUser: targetUser,
      timestamp: time,
      isSelf: true
    };
    
    setMessages((prev) => [...prev, myMessage]);
    
    // Transmit
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: {
        senderName: userEmail,
        text: inputText,
        type: 'text',
        targetUser: targetUser,
        timestamp: time.toISOString()
      }
    });

    setInputText('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64AudioMessage = reader.result as string;
          const time = new Date();
          
          const myAudioMsg: ChatMessage = {
            id: Math.random().toString(36).substring(7),
            senderName: userEmail,
            audioData: base64AudioMessage,
            type: 'audio',
            targetUser: targetUser,
            timestamp: time,
            isSelf: true
          };
          
          setMessages((prev) => [...prev, myAudioMsg]);
          
          await channel?.send({
            type: 'broadcast',
            event: 'new_message',
            payload: {
              senderName: userEmail,
              audioData: base64AudioMessage,
              type: 'audio',
              targetUser: targetUser,
              timestamp: time.toISOString()
            }
          });
        };

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Para usar el radio (voz), necesitas habilitar el permiso de micrófono en tu navegador (arriba a la izquierda en el candado).");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100vh-6rem)]">
      <header className="mb-6 border-b border-slate-800 pb-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wider uppercase flex items-center gap-2 md:gap-3">
              <Radio className={`w-6 h-6 md:w-8 md:h-8 shrink-0 ${isConnected ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
              Frecuencia de Ingenieros
            </h1>
            <p className="mt-2 text-slate-400 text-sm tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Canal táctico efímero con soporte para transmisiones cifradas (privadas).
            </p>
          </div>
          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2 w-full md:w-auto mt-2 md:mt-0">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${
              isConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
              {isConnected ? 'Transmitiendo' : 'Sin Señal'}
            </div>
            {isConnected && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold text-white">{onlineUsers.length + 1}</span> en línea
              </div>
            )}
          </div>
        </div>

        {/* Online Operators Strip */}
        {isConnected && onlineUsers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mr-2">Operadores:</span>
            {onlineUsers.map(user => (
              <div key={user} className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/50 rounded-lg pl-3 pr-1.5 py-1.5 shadow-sm group">
                <span className="text-[10px] font-bold text-blue-300 font-mono tracking-tighter truncate max-w-[100px]">{user}</span>
                <div className="flex items-center">
                  <button 
                    onClick={() => makeCall(user)}
                    className="p-1 hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 rounded transition-all"
                    title={`Llamar a ${user}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleSendBipper(user)}
                    className="p-1 hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 rounded transition-all"
                    title={`Mandar Bip a ${user}`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button 
              onClick={() => handleSendBipper('ALL')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-600/20 transition-all text-[9px] font-bold uppercase tracking-widest"
            >
              <Bell className="w-3.5 h-3.5" /> Alertar a Todos
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-slate-950/50">
          <div className="w-full text-center py-4 mb-4 border-b border-slate-800/50">
            <span className="inline-block px-3 py-1 bg-slate-800/80 rounded border border-slate-700 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              --- CANAL ENCRIPTADO ABIERTO ---
            </span>
            <p className="text-[10px] text-slate-500 mt-2 font-mono">
              El canal procesará notas de voz y mensajes en texto. Selecciona un operador abajo para envíos confidenciales.
            </p>
          </div>

          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
              <Zap className="w-12 h-12 mb-3" />
              <p className="text-sm font-mono uppercase tracking-widest">Esperando transmisiones...</p>
            </div>
          )}

          {messages.map((msg) => {
            const isPrivate = msg.targetUser !== 'ALL';
            
            // Colores por defecto (Público)
            let bubbleStyle = msg.isSelf 
              ? 'bg-blue-600/20 border-blue-500/30 text-blue-100 rounded-tr-sm' 
              : 'bg-slate-800/80 border-slate-700 text-slate-200 rounded-tl-sm';
            let nameColor = msg.isSelf ? 'text-blue-400' : 'text-amber-400';

            // Override si es privado (Morado)
            if (isPrivate) {
              bubbleStyle = msg.isSelf 
                ? 'bg-purple-600/20 border-purple-500/40 text-purple-100 rounded-tr-sm' 
                : 'bg-purple-900/40 border-purple-500/40 text-purple-100 rounded-tl-sm';
              nameColor = 'text-purple-400';
            }

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 mb-2`}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${nameColor} flex items-center gap-1`}>
                    {isPrivate && <Lock className="w-3 h-3" />}
                    {msg.isSelf ? 'TÚ' : msg.senderName}
                    {isPrivate && msg.isSelf && <span className="text-slate-500 font-mono font-normal">➔ {msg.targetUser}</span>}
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono">
                    [{formatTime(msg.timestamp)}]
                  </span>
                </div>
                
                {msg.type === 'audio' && msg.audioData ? (
                  <div className={`px-4 py-2.5 rounded-lg border shadow-sm ${bubbleStyle}`}>
                    <audio src={msg.audioData} controls className="h-10 max-w-[200px] outline-none" />
                  </div>
                ) : (
                  <div className={`px-4 py-2.5 rounded-lg max-w-[85%] relative border shadow-sm ${bubbleStyle}`}>
                    <p className="text-sm font-mono whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-slate-900 border-t border-slate-800">
          
          {/* Privacty/Target Selector Ribbon */}
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center gap-3">
             <Lock className={`w-3.5 h-3.5 ${targetUser === 'ALL' ? 'text-slate-600' : 'text-purple-500'}`} />
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transmitir A:</span>
             <select 
                value={targetUser} 
                onChange={(e) => setTargetUser(e.target.value)}
                className={`bg-transparent outline-none text-xs font-bold font-mono tracking-wide ${
                  targetUser === 'ALL' ? 'text-blue-400' : 'text-purple-400'
                }`}
             >
               <option value="ALL" className="bg-slate-900 text-blue-400">[ TODOS (PÚBLICO) ]</option>
               {onlineUsers.map(user => (
                 <option key={user} value={user} className="bg-slate-900 text-purple-400">► {user}</option>
               ))}
             </select>
          </div>

          <form onSubmit={handleSendMessage} className="p-4 flex gap-3">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isConnected}
              title={isRecording ? "Detener y Enviar" : "Grabar Nota de Voz"}
              className={`p-3 rounded-lg transition-colors shadow-lg flex-shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                isRecording 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-2 ring-rose-500/50' 
                  : targetUser !== 'ALL' 
                    ? 'bg-purple-600 hover:bg-purple-500 text-white' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>

            {isRecording ? (
               <div className="flex-1 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center justify-center p-3 animate-pulse cursor-not-allowed">
                 <span className="text-rose-400 font-mono text-sm tracking-widest font-bold">
                   [ REC ] 0:{(recordingTime < 10 ? '0' : '') + recordingTime} / 0:30
                 </span>
               </div>
            ) : (
              <div className="relative flex-1 flex gap-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={targetUser === 'ALL' ? "Escribe un mensaje de difusión..." : `Escribe un mensaje privado a ${targetUser}...`}
                  disabled={!isConnected}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || !isConnected}
                  className={`disabled:bg-slate-800 disabled:text-slate-500 text-white p-3 rounded-lg transition-colors shadow-lg flex-shrink-0 ${
                    targetUser === 'ALL' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Voice Call Overlay */}
      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
          <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
            
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 relative ${
              callStatus === 'connected' ? 'bg-emerald-500/20 ring-4 ring-emerald-500/30' : 'bg-blue-500/20 ring-4 ring-blue-500/30'
            }`}>
              {callStatus === 'incoming' ? (
                <PhoneIncoming className="w-10 h-10 text-emerald-400 animate-bounce" />
              ) : callStatus === 'calling' ? (
                <Volume2 className="w-10 h-10 text-blue-400 animate-pulse" />
              ) : (
                <Radio className="w-10 h-10 text-emerald-400" />
              )}
              
              {callStatus === 'connected' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                   <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-white mb-1 uppercase tracking-wider">{currentPeer}</h3>
            <p className={`text-xs font-mono mb-8 uppercase tracking-widest ${
              callStatus === 'connected' ? 'text-emerald-400' : 'text-slate-500 animate-pulse'
            }`}>
              {callStatus === 'incoming' ? 'Llamada Entrante' : 
               callStatus === 'calling' ? 'Llamando...' : 
               callStatus === 'connected' ? 'CONEXIÓN ESTABLECIDA' : 'Finalizando...'}
            </p>

            <div className="flex gap-6">
              {callStatus === 'incoming' && (
                <button
                  onClick={() => {
                    acceptCall();
                    setIncomingCall(null);
                  }}
                  className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                >
                  <Phone className="w-6 h-6 text-white" />
                </button>
              )}
              
              <button
                onClick={() => {
                  hangUp();
                  setIncomingCall(null);
                }}
                className="w-14 h-14 bg-rose-600 hover:bg-rose-700 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Remote Audio Element (Hidden) */}
            {remoteStream && (
               <audio 
                 ref={(el) => { if (el) el.srcObject = remoteStream; }} 
                 autoPlay 
                 className="hidden" 
               />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

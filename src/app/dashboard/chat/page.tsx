'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Paperclip, X, Volume2, VolumeX, Zap, Database, ImagePlus, Loader2, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'dola';
  text: string;
  imagePreview?: string;
  usedManuals?: boolean;
  timestamp: Date;
}

// ── Speech Recognition type shim ──────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function DolaPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [engineerId, setEngineerId] = useState<string | null>(null);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setEngineerId(data.user.email || data.user.id);
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;
    stopSpeaking();

    // Clean text for TTS: remove markdown, keep content literal
    const clean = text
      .replace(/[*#_`|\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  }, [stopSpeaking]);

  // ── Microphone ────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!mounted) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [mounted, isListening]);

  // ── File Attachment ───────────────────────────────────────────────────────
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachedFile(f);
    const reader = new FileReader();
    reader.onload = () => setAttachedPreview(reader.result as string);
    reader.readAsDataURL(f);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    setAttachedPreview(null);
  };

  // ── Send Message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText || '(archivo adjunto)',
      imagePreview: attachedPreview || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    stopSpeaking();

    try {
      let imageBase64: string | null = null;
      let imageMimeType: string | null = null;

      if (attachedFile) {
        const buffer = await attachedFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        imageBase64 = btoa(binary);
        imageMimeType = attachedFile.type;
      }

      clearAttachment();

      const res = await fetch('/api/chat-multimodal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText || undefined,
          imageBase64,
          imageMimeType,
          engineerId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al contactar a DOLA.');
      }

      const dolaMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'dola',
        text: data.response,
        usedManuals: data.usedManuals,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, dolaMsg]);
      // Auto-speak DOLA's response
      speakText(data.response);

    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'dola',
        text: `⚠️ ${err.message || 'No pude procesar la solicitud. Intenta de nuevo.'}`,
        usedManuals: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div suppressHydrationWarning className="max-w-5xl mx-auto h-[calc(100dvh-5rem)] md:h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-900/30">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">DOLA</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide">Asistente Técnico · NCR · Diebold · GRG</p>
          </div>
        </div>

        {isSpeaking && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={stopSpeaking}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500/30 transition-colors"
          >
            <VolumeX className="w-4 h-4" />
            Detener Voz
          </motion.button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Welcome */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center gap-6 py-12"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center">
                <Bot className="w-10 h-10 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">¡Hola! Soy DOLA</h2>
                <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                  Tu experta técnica en cajeros automáticos. Puedo ayudarte con fallas, consultar los manuales y analizar fotos de errores.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-2xl w-full">
                {[
                  { icon: '🔧', text: 'Error 012 en dispensador NCR 6622' },
                  { icon: '📷', text: 'Sube una foto de la placa o módulo' },
                  { icon: '🎙️', text: 'Usa el micrófono para hablar' },
                ].map((s, i) => (
                  <button key={i} onClick={() => setInput(s.text)} className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-left hover:border-violet-500/40 hover:bg-slate-800 transition-all group">
                    <span className="text-xl mb-1 block">{s.icon}</span>
                    <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{s.text}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'dola' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`max-w-[75%] space-y-2 ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                  {/* Image preview */}
                  {msg.imagePreview && (
                    <div className={`rounded-2xl overflow-hidden border border-slate-700 ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                      <img src={msg.imagePreview} alt="Adjunto" className="max-w-xs max-h-48 object-cover" />
                    </div>
                  )}

                  {/* Text bubble */}
                  {msg.text && msg.text !== '(archivo adjunto)' && (
                    <div className={`p-4 rounded-2xl shadow-lg ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-tr-sm'
                        : 'bg-slate-800 border border-slate-700/50 text-slate-200 rounded-tl-sm'
                    }`}>
                      {msg.role === 'dola' && (
                        <div className="flex items-center justify-between mb-2 gap-4">
                          <div className="flex items-center gap-2">
                            {msg.usedManuals
                              ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                  <Database className="w-2.5 h-2.5" />Manual
                                </span>
                              : <span className="flex items-center gap-1 text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                  <Zap className="w-2.5 h-2.5" />General
                                </span>
                            }
                          </div>
                          <button
                            suppressHydrationWarning
                            onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.text)}
                            className="p-1 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                            title="Escuchar respuesta"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading bubble */}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700/50 p-4 rounded-2xl rounded-tl-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                <span className="text-xs text-slate-400 italic">Consultando manuales y analizando...</span>
              </div>
            </motion.div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-800 p-4 bg-slate-950/60">
          {/* Attachment Preview */}
          {attachedPreview && (
            <div className="mb-3 flex items-start gap-2">
              <div className="relative">
                <img src={attachedPreview} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-slate-700" />
                <button
                  onClick={clearAttachment}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500 pt-1">
                <p className="text-slate-400 font-medium truncate max-w-xs">{attachedFile?.name}</p>
                <p>{((attachedFile?.size || 0) / 1024).toFixed(0)} KB</p>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 md:gap-3">
            {/* Mic Button */}
            <button
              suppressHydrationWarning
              onClick={toggleMic}
              className={`p-3 rounded-xl transition-all flex-shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
              title={isListening ? 'Detener micrófono' : 'Activar micrófono'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={isListening ? '🎙️ Escuchando...' : 'Escribe tu consulta técnica o usa el micrófono...'}
                rows={1}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm py-3 px-4 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all placeholder:text-slate-600 resize-none leading-relaxed"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            {/* Attach Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all flex-shrink-0"
              title="Adjuntar imagen o video"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileAttach} />

            {/* Send Button */}
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !attachedFile) || isLoading}
              className="p-3 bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 transition-all flex-shrink-0 shadow-lg shadow-violet-900/20"
              title="Enviar"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>

          {/* Status bar */}
          <div suppressHydrationWarning className="flex items-center justify-between mt-2 px-1">
            <p suppressHydrationWarning className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">
              {isListening ? '🔴 Micrófono activo — habla ahora' : 'Enter para enviar · Shift+Enter nueva línea'}
            </p>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">GEMINI 1.5 FLASH</p>
          </div>
        </div>
      </div>
    </div>
  );
}

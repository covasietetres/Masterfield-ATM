'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Paperclip, X, Volume2, VolumeX, Zap, Database, ImagePlus, Loader2, Bot, Eye, AlignLeft, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
interface KnowledgeDocument {
  id: string;
  title: string;
  file_type: 'pdf' | 'image' | 'video';
  brand: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  content_text?: string;
}

interface Message {
  id: string;
  role: 'user' | 'dola';
  text: string;
  imagePreview?: string;
  usedManuals?: boolean;
  sources?: KnowledgeDocument[];
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

  // Document Viewer State
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [ocrMode, setOcrMode] = useState(false);
  const [isSpeakingOCR, setIsSpeakingOCR] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrTextRef = useRef<HTMLDivElement>(null);

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

  const speakOCR = useCallback((text: string) => {
    if (!synthRef.current || !text) return;
    stopSpeaking();

    const cleanText = text
      .replace(/[*#_`|\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeakingOCR(true);
    utterance.onend = () => setIsSpeakingOCR(false);
    utterance.onerror = () => setIsSpeakingOCR(false);

    synthRef.current.speak(utterance);
  }, [stopSpeaking]);

  const getPublicUrl = (doc: KnowledgeDocument) => {
    const bucket = doc.file_type === 'pdf' ? 'manuals' : 'media';
    const { data } = supabase.storage.from(bucket).getPublicUrl(doc.storage_path);
    return data.publicUrl;
  };

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
        sources: data.sources,
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
      <header className="flex items-center justify-between mb-8 p-6 rounded-[2rem] glass-card animate-fade-in-up">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-900/40 border border-white/10">
              <Bot className="w-8 h-8 text-white animate-float" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-slate-950 shadow-lg shadow-emerald-500/20 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase leading-none">DOLA <span className="text-violet-500">IA</span></h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Terminal de Asistencia Avanzada</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Gemini 2.0 Flash
          </div>
          {isSpeaking && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={stopSpeaking}
              className="flex items-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all shadow-xl shadow-rose-900/40 active:scale-95"
            >
              <VolumeX className="w-4 h-4" />
              Detener Voz
            </motion.button>
          )}
        </div>
      </header>


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
                    <div className={`p-5 rounded-[1.8rem] shadow-2xl transition-all ${
                      msg.role === 'user'
                         ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm glow-blue'
                         : 'bg-slate-900 border border-white/5 text-slate-200 rounded-tl-sm backdrop-blur-xl'
                    }`}>
                      {msg.role === 'dola' && (
                        <div className="flex items-center justify-between mb-3 gap-4">
                          <div className="flex items-center gap-2">
                            {msg.usedManuals
                               ? <span className="flex items-center gap-1.5 text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-widest shadow-inner">
                                   <Database className="w-2.5 h-2.5" />Manual Verificado
                                 </span>
                               : <span className="flex items-center gap-1.5 text-[8px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-widest shadow-inner">
                                   <Zap className="w-2.5 h-2.5" />Conocimiento IA
                                 </span>
                            }
                          </div>
                          <button
                            suppressHydrationWarning
                            onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.text)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all active:scale-90"
                            title="Escuchar respuesta"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
                      
                      {/* Sources / Documents found */}
                      {msg.role === 'dola' && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                            <Database className="w-3 h-3 text-violet-500" /> Referencias Técnicas
                          </p>
                          <div className="grid grid-cols-1 gap-3">
                            {msg.sources.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-violet-500/30 transition-all group cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="p-2 rounded-xl bg-violet-600/10 text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-all">
                                    <Database className="w-4 h-4" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <span className="text-xs text-white truncate block uppercase font-black tracking-tight leading-none mb-1">
                                      {doc.title}
                                    </span>
                                    <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">{doc.brand} · {doc.file_type}</span>
                                  </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
                <Bot className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-slate-900 border border-white/5 p-5 rounded-[1.8rem] rounded-tl-sm flex items-center gap-3 shadow-xl backdrop-blur-xl">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"></span>
                </div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Analizando manuales y visuales...</span>
              </div>
            </motion.div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-white/5 p-6 bg-slate-950/80 backdrop-blur-3xl rounded-b-[2rem]">
          {/* Attachment Preview */}
          {attachedPreview && (
            <div className="mb-4 flex items-start gap-3">
              <div className="relative group">
                <img src={attachedPreview} alt="preview" className="h-20 w-20 object-cover rounded-2xl border-2 border-violet-500/50 shadow-2xl shadow-violet-500/20" />
                <button
                  onClick={clearAttachment}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-500 transition-all shadow-lg active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="pt-2">
                <p className="text-[10px] text-white font-black uppercase tracking-widest mb-1 truncate max-w-[150px]">{attachedFile?.name}</p>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{((attachedFile?.size || 0) / 1024).toFixed(0)} KB · Imagen Técnica</p>
              </div>
            </div>
          )}

          <div className="flex items-end gap-3 md:gap-4">
            {/* Mic Button */}
            <button
              suppressHydrationWarning
              onClick={toggleMic}
              className={`p-4 rounded-2xl transition-all flex-shrink-0 shadow-2xl border-2 ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-400 animate-pulse glow-blue shadow-rose-900/40'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border-white/5'
              }`}
              title={isListening ? 'Detener micrófono' : 'Activar micrófono'}
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* Text Input */}
            <div className="flex-1 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-[1.5rem] opacity-0 group-focus-within:opacity-20 transition-opacity blur" />
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={isListening ? '🎙️ Escuchando frecuencia...' : 'Escribe tu consulta técnica o usa el micrófono...'}
                rows={1}
                className="w-full bg-slate-900 border border-white/5 text-white text-sm py-4 px-6 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500/40 transition-all placeholder:text-slate-600 resize-none leading-relaxed shadow-inner"
                style={{ minHeight: '56px', maxHeight: '150px' }}
              />
            </div>

            {/* Attach Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-4 bg-slate-900 border-2 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all flex-shrink-0 shadow-xl"
              title="Adjuntar imagen o video"
            >
              <ImagePlus className="w-6 h-6" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileAttach} />

            {/* Send Button */}
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !attachedFile) || isLoading}
              className="p-4 bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 transition-all flex-shrink-0 shadow-2xl shadow-violet-900/40 active:scale-90"
              title="Enviar"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </div>

          {/* Status bar */}
          <div suppressHydrationWarning className="flex items-center justify-between mt-4 px-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span> Conectado
              </span>
              <p suppressHydrationWarning className="text-[8px] text-slate-600 uppercase tracking-widest font-black">
                {isListening ? '🔴 Transmitiendo' : 'Shift + Enter para línea'}
              </p>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Motor:</span>
               <span className="text-[8px] text-violet-500 font-black uppercase tracking-widest bg-violet-500/5 px-2 py-0.5 rounded border border-violet-500/10">GEMINI 2.0 FLASH</span>
            </div>
          </div>
        </div>
      </div>

      </div>

      {/* === DOCUMENT VIEWER MODAL === */}
      <AnimatePresence>
        {mounted && selectedDoc && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            suppressHydrationWarning
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border-b border-slate-800 bg-slate-950 flex-shrink-0 gap-3">
                <div className="flex items-start justify-between w-full sm:w-auto gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-violet-500/10 p-2 rounded shrink-0">
                      <Database className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-white font-bold text-sm truncate max-w-[200px] sm:max-w-md uppercase tracking-tight">{selectedDoc.title}</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Documento {selectedDoc.file_type} · {selectedDoc.brand}</p>
                    </div>
                  </div>
                  
                  <button
                    suppressHydrationWarning
                    onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
                    className="sm:hidden p-1 -mr-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div suppressHydrationWarning className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <button
                    onClick={() => setOcrMode(!ocrMode)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex-1 sm:flex-none justify-center ${
                      ocrMode ? 'bg-violet-600 text-white border-violet-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <AlignLeft className="w-4 h-4" />
                    {ocrMode ? 'Ocultar OCR' : 'Ver OCR'}
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={() => isSpeakingOCR ? stopSpeaking() : speakOCR(selectedDoc.content_text || '')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex-1 sm:flex-none justify-center ${
                      isSpeakingOCR
                        ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                    }`}
                  >
                    {isSpeakingOCR ? <VolumeX className="w-4 h-4 shrink-0" /> : <Volume2 className="w-4 h-4 shrink-0" />}
                    <span suppressHydrationWarning className="truncate">{isSpeakingOCR ? 'Detener Lectura' : 'Lectura Inteligente'}</span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
                    className="hidden sm:block p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0 ml-auto"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 flex overflow-hidden">
                <div className={`transition-all duration-300 bg-slate-950 relative overflow-hidden ${ocrMode ? 'w-1/2' : 'w-full'}`}>
                  {selectedDoc.file_type === 'pdf' ? (
                    <iframe
                      suppressHydrationWarning
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(getPublicUrl(selectedDoc))}&embedded=true`}
                      className="w-full h-full border-none"
                      title={selectedDoc.title}
                    />
                  ) : selectedDoc.file_type === 'image' ? (
                    <div suppressHydrationWarning className="w-full h-full flex items-center justify-center p-8 overflow-auto">
                      <img suppressHydrationWarning src={getPublicUrl(selectedDoc)} alt={selectedDoc.title} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
                    </div>
                  ) : selectedDoc.file_type === 'video' ? (
                    <div suppressHydrationWarning className="w-full h-full flex items-center justify-center p-4">
                      <video suppressHydrationWarning src={getPublicUrl(selectedDoc)} controls className="max-w-full max-h-full rounded-lg shadow-xl" />
                    </div>
                  ) : (
                    <div suppressHydrationWarning className="w-full h-full flex items-center justify-center text-slate-500">
                      Visor no disponible.
                    </div>
                  )}
                </div>

                {ocrMode && (
                  <div className="w-1/2 border-l border-slate-800 flex flex-col bg-slate-950">
                    <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <AlignLeft className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Texto Extraído (OCR)</span>
                      </div>
                    </div>
                    <div ref={ocrTextRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {selectedDoc.content_text ? (
                        <p className="text-slate-300 text-xs leading-7 whitespace-pre-wrap font-mono tracking-wide">
                          {selectedDoc.content_text}
                        </p>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                          <BookOpen className="w-10 h-10 text-slate-700" />
                          <p className="text-slate-500 text-xs font-bold uppercase">Sin texto extraído</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center flex-shrink-0">
                <div className="text-[10px] text-slate-600 font-mono">
                  ID: {selectedDoc.id.substring(0, 8)}...
                </div>
                <a
                  href={getPublicUrl(selectedDoc)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-2"
                >
                  Abrir original
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

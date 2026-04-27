'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  Database,
  Eye,
  Volume2,
  VolumeX,
  X,
  Loader2,
  Bot,
  MessageSquare,
  AlignLeft,
  BookOpen,
  RotateCcw
} from 'lucide-react';
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
  indexing?: boolean;
}

export default function ConsultaPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Document Viewer State
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [ocrMode, setOcrMode] = useState(false);
  const [isSpeakingOCR, setIsSpeakingOCR] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const ocrTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeakingOCR(false);
  }, []);

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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || query.trim().length < 3 || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al buscar.');
      setResults(data.sources || []);
    } catch (err) {
      console.error(err);
      alert('No se pudo procesar la consulta.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPublicUrl = (doc: KnowledgeDocument) => {
    const bucket = doc.file_type === 'pdf' ? 'manuals' : 'media';
    const { data } = supabase.storage.from(bucket).getPublicUrl(doc.storage_path);
    return data.publicUrl;
  };

  const handleReindex = async (doc: KnowledgeDocument) => {
    if (doc.indexing) return;
    try {
      setResults(prev => prev.map(d => d.id === doc.id ? { ...d, indexing: true } : d));
      if (selectedDoc?.id === doc.id) setSelectedDoc({ ...selectedDoc, indexing: true });

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          bucket: doc.file_type === 'pdf' ? 'manuals' : 'media',
          path: doc.storage_path,
          fileType: doc.file_type,
          title: doc.title
        })
      });

      if (!res.ok) throw new Error('Falla en el motor de ingesta');

      // Consultar el documento actualizado
      const { data: updatedDoc, error: updateError } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('id', doc.id)
        .single();

      if (updateError) throw updateError;

      setResults(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
      if (selectedDoc?.id === doc.id) setSelectedDoc(updatedDoc);
      alert('¡Documento procesado correctamente! Ahora la lectura inteligente está disponible.');
    } catch (err: any) {
      console.error(err);
      alert('Error de indexación: ' + err.message);
    } finally {
      setResults(prev => prev.map(d => d.id === doc.id ? { ...d, indexing: false } : d));
      if (selectedDoc?.id === doc.id) setSelectedDoc(prev => prev ? { ...prev, indexing: false } : null);
    }
  };

  return (
    <div suppressHydrationWarning className="max-w-6xl mx-auto space-y-8 md:space-y-12 py-6 md:py-8 pb-20 md:pb-8">
      {/* Search Section */}
      <section className="text-center space-y-6 md:space-y-10 px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse" />
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-2xl shadow-blue-900/40 ring-1 ring-white/20">
              <Bot className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl md:text-5xl font-black text-white tracking-tighter md:tracking-widest uppercase">
              Asistente de Campo IA
            </h1>
            <p className="text-[10px] md:text-sm text-slate-500 font-black uppercase tracking-[0.3em]">
              Búsqueda Semántica en Corpus Técnico
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="max-w-3xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-[2rem] blur opacity-20 group-focus-within:opacity-40 transition-all duration-500" />
          <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-500">
            <div className="pl-6 text-slate-600 group-focus-within:text-blue-400 transition-colors">
              <Search className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ej. Error 12 NCR, Manual 6622..."
              className="flex-1 bg-transparent border-none text-white text-base md:text-xl py-5 md:py-7 px-4 md:px-8 focus:outline-none placeholder:text-slate-700 font-bold tracking-tight"
            />
            <button
              type="submit"
              disabled={isLoading || query.length < 3}
              className="mr-3 md:mr-4 p-4 md:p-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all disabled:opacity-50 disabled:bg-slate-800 shadow-xl shadow-blue-900/40 active:scale-95"
            >
              {isLoading ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <Send className="w-6 h-6 md:w-7 md:h-7" />}
            </button>
          </div>
        </form>
      </section>

      {/* Results Area */}
      <section className="relative px-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin shadow-2xl shadow-blue-500/20" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Consultando Cerebro Central...</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {results.length > 0 && !isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8"
            >
              {results.map((doc, idx) => (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-3xl flex flex-col gap-6 hover:border-blue-500/50 hover:bg-slate-800 transition-all group shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 group-hover:scale-110 shadow-lg">
                      <Database className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] bg-slate-800 px-3 py-1.5 rounded-xl text-slate-400 uppercase font-black tracking-widest border border-slate-700 shadow-inner">
                      {doc.file_type}
                    </span>
                  </div>

                  <div className="flex-1 relative z-10">
                    <h3 className="text-white font-black text-base md:text-lg tracking-tight uppercase line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                      {doc.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{doc.brand}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-800/50 relative z-10">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="flex-1 flex items-center justify-center gap-3 py-4 bg-slate-950 hover:bg-blue-600 text-slate-400 hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shadow-xl border border-slate-800 active:scale-95"
                    >
                      <Eye className="w-4 h-4" /> Visualizar
                    </button>
                    <button
                      onClick={() => {
                        if (doc.content_text) {
                          isSpeakingOCR ? stopSpeaking() : speakOCR(doc.content_text);
                        } else {
                          handleReindex(doc);
                        }
                      }}
                      className={`flex items-center justify-center p-4 rounded-2xl transition-all shadow-xl active:scale-95 border ${
                        doc.indexing
                          ? 'bg-blue-600 animate-pulse text-white border-blue-400'
                          : isSpeakingOCR
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-emerald-600 hover:text-white hover:border-emerald-500'
                        }`}
                      title={!doc.content_text ? "Extraer texto (re-indexar)" : "Lectura inteligente"}
                    >
                      {doc.indexing ? <RotateCcw className="w-5 h-5 animate-spin" /> : (isSpeakingOCR ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />)}
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : query && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 text-center gap-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-slate-800 blur-3xl opacity-20 rounded-full" />
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] relative z-10 shadow-2xl">
                  <Search className="w-16 h-16 text-slate-800" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-slate-400 text-sm md:text-base font-black uppercase tracking-[0.2em]">Cero Coincidencias en el Radar</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                  El término "{query}" no está en el núcleo de memoria. Prueba con descriptores de hardware o códigos de error.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* === DOCUMENT VIEWER MODAL === */}
      <AnimatePresence>
        {mounted && selectedDoc && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            suppressHydrationWarning
            className="fixed inset-0 z-[70] flex items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-md"
            onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border-none md:border md:border-slate-700 w-full max-w-6xl h-screen md:h-[90vh] md:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border-b border-slate-800 bg-slate-950 flex-shrink-0 gap-3">
                <div className="flex items-start justify-between w-full sm:w-auto gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-blue-500/10 p-2 rounded shrink-0">
                      <Database className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-white font-bold text-sm truncate max-w-[200px] sm:max-w-md uppercase tracking-tight">{selectedDoc.title}</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Documento {selectedDoc.file_type} · {selectedDoc.brand}</p>
                    </div>
                  </div>

                  <button
                    suppressHydrationWarning
                    onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
                    className="sm:hidden p-3 -mr-2 bg-blue-600 text-white rounded-xl shadow-xl shadow-blue-900/40 active:scale-95 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div suppressHydrationWarning className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <button
                    suppressHydrationWarning
                    onClick={() => isSpeakingOCR ? stopSpeaking() : (selectedDoc.content_text ? speakOCR(selectedDoc.content_text) : handleReindex(selectedDoc))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex-1 sm:flex-none justify-center ${selectedDoc.indexing
                        ? 'bg-blue-600 animate-pulse text-white border-blue-500'
                        : isSpeakingOCR
                          ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                      }`}
                  >
                    {selectedDoc.indexing ? (
                      <RotateCcw className="w-4 h-4 animate-spin shrink-0" />
                    ) : isSpeakingOCR ? (
                      <VolumeX className="w-4 h-4 shrink-0" />
                    ) : (
                      <Volume2 className="w-4 h-4 shrink-0" />
                    )}
                    <span suppressHydrationWarning className="truncate">
                      {selectedDoc.indexing ? 'Procesando...' : isSpeakingOCR ? 'Detener Lectura' : 'Lectura Inteligente'}
                    </span>
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
                          <div className="space-y-4">
                            <div>
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Sin texto extraído</p>
                              <p className="text-slate-600 text-[10px] mt-1 uppercase tracking-tight">Presiona el botón para procesar este archivo ahora</p>
                            </div>
                            <button
                              onClick={() => handleReindex(selectedDoc)}
                              disabled={selectedDoc.indexing}
                              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 mx-auto ${selectedDoc.indexing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                            >
                              <RotateCcw className={`w-4 h-4 ${selectedDoc.indexing ? 'animate-spin' : ''}`} />
                              {selectedDoc.indexing ? 'Procesando con IA...' : 'Procesar con OCR'}
                            </button>
                          </div>
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

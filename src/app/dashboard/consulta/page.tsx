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
    <div suppressHydrationWarning className="max-w-6xl mx-auto space-y-12 py-8">
      {/* Search Section */}
      <section className="text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-2xl shadow-blue-900/30">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-widest uppercase">Consulta Técnica</h1>
            <p className="text-slate-400 font-medium tracking-wide">Hola ingeniero, ¿Qué documento deseas consultar hoy?</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="max-w-3xl mx-auto relative group px-4">
          <div className="absolute inset-0 bg-blue-600/20 blur-3xl group-focus-within:bg-blue-600/40 transition-all" />
          <div className="relative flex items-center bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl focus-within:border-blue-500/50 transition-all">
            <div className="pl-6 text-slate-500 group-focus-within:text-blue-400 transition-colors">
              <Search className="w-6 h-6" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Manual NCR Dispensador, Error 12, Diebold 5500..."
              className="flex-1 bg-transparent border-none text-white text-lg py-5 px-6 focus:outline-none placeholder:text-slate-600 font-medium"
            />
            <button
              type="submit"
              disabled={isLoading || query.length < 3}
              className="mr-3 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:bg-slate-800"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </div>
        </form>
      </section>

      {/* Results Area */}
      <section className="relative px-4">
        <AnimatePresence mode="popLayout">
          {results.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {results.map((doc, idx) => (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all group shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                      <Database className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded-full text-slate-400 uppercase font-black tracking-widest">{doc.file_type}</span>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-white font-bold text-sm tracking-tight uppercase line-clamp-2">{doc.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">{doc.brand}</p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-800/50">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest shadow-lg"
                    >
                      <Eye className="w-4 h-4" /> Ver Documento
                    </button>
                    <button
                      onClick={() => {
                        if (doc.content_text) {
                          isSpeakingOCR ? stopSpeaking() : speakOCR(doc.content_text);
                        } else {
                          handleReindex(doc);
                        }
                      }}
                      className={`flex items-center justify-center p-2.5 rounded-xl transition-all shadow-lg ${
                        doc.indexing 
                          ? 'bg-blue-600 animate-pulse text-white'
                          : isSpeakingOCR 
                          ? 'bg-red-500/20 text-red-500 ring-1 ring-red-500/30' 
                          : 'bg-slate-800 text-slate-400 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title={!doc.content_text ? "Extraer texto (re-indexar)" : "Lectura inteligente"}
                    >
                      {doc.indexing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : query && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center gap-4"
            >
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl opacity-50">
                <Search className="w-12 h-12 text-slate-700" />
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">No encontramos registros técnicos para "{query}"</p>
                <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-tight">Intenta con palabras clave más generales...</p>
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
                    className="sm:hidden p-1 -mr-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div suppressHydrationWarning className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <button
                    suppressHydrationWarning
                    onClick={() => isSpeakingOCR ? stopSpeaking() : (selectedDoc.content_text ? speakOCR(selectedDoc.content_text) : handleReindex(selectedDoc))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex-1 sm:flex-none justify-center ${
                      selectedDoc.indexing
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
                              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 mx-auto ${
                                selectedDoc.indexing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'
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

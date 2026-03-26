'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, Database, Eye, X, Trash2, PenTool, MapPin, Tag, RotateCcw, Volume2, VolumeX, BookOpen, AlignLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';

export default function KnowledgeBasePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // OCR Reading Mode
  const [ocrMode, setOcrMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const ocrTextRef = useRef<HTMLDivElement>(null);

  // Experience Form State
  const [experienceForm, setExperienceForm] = useState({
    brand: 'NCR',
    model: '',
    faultType: '',
    location: '',
    description: '',
    engineerName: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Reset OCR mode when document changes
  useEffect(() => {
    setOcrMode(false);
    stopSpeaking();
  }, [selectedDoc]);

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const speakOCR = (text: string) => {
    if (!synthRef.current || !text) return;
    stopSpeaking();

    // Pure OCR cleanup: only remove markdown symbols, preserve all text
    const cleanText = text
      .replace(/[*#_`|\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95;   // Slightly slower for clarity in OCR mode
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*, knowledge_chunks(count)')
      .order('created_at', { ascending: false });
    if (!error && data) setDocuments(data);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setSuccess(false);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      let fileType = 'pdf';
      let bucket = 'manuals';

      if (['png', 'jpg', 'jpeg'].includes(fileExt)) {
        fileType = 'image';
        bucket = 'media';
      } else if (['mp4', 'webm'].includes(fileExt)) {
        fileType = 'video';
        bucket = 'media';
      } else if (fileExt !== 'pdf') {
        throw new Error('Formato no soportado. Por favor sube PDF, Imagen o Video.');
      }

      const fileName = `${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = bucket === 'media' ? `uploads/${fileName}` : `${fileName}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw new Error(`Error de subida: ${uploadError.message}`);

      const { data: userData } = await supabase.auth.getUser();
      const { data: docData, error: dbError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: file.name,
          file_type: fileType,
          brand: 'General',
          storage_path: filePath,
          uploaded_by: userData.user?.email || 'Usuario'
        })
        .select()
        .single();

      if (dbError || !docData) throw new Error(`Error en registro: ${dbError?.message}`);

      await handleReindex(docData, bucket);
      setSuccess(true);
      setFile(null);
      fetchDocuments();
    } catch (error: any) {
      alert(error.message || 'Error al subir archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleReindex = async (doc: any, bucket?: string) => {
    const targetBucket = bucket || (doc.file_type === 'pdf' ? 'manuals' : 'media');
    try {
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, indexing: true } : d));

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          bucket: targetBucket,
          path: doc.storage_path,
          fileType: doc.file_type,
          title: doc.title
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Falla en el motor de ingesta');
      }

      await fetchDocuments();

      if (selectedDoc?.id === doc.id) {
        const { data: updatedDoc } = await supabase
          .from('knowledge_documents')
          .select('*')
          .eq('id', doc.id)
          .single();
        if (updatedDoc) setSelectedDoc(updatedDoc);
      }
    } catch (error: any) {
      alert('Error de indexación: ' + error.message);
    }
  };

  const handleShareExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experienceForm.description || !experienceForm.engineerName) {
      alert('Por favor completa los campos obligatorios.');
      return;
    }

    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text("ATM FIELD MASTER - REPORTE TÉCNICO", 20, 30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DATOS DEL CASO:", 20, 50);
      doc.setFont("helvetica", "normal");
      doc.text(`Cajero: ${experienceForm.brand} ${experienceForm.model}`, 20, 60);
      doc.text(`Falla: ${experienceForm.faultType}`, 20, 70);
      doc.text(`Ubicación: ${experienceForm.location}`, 20, 80);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 90);
      doc.text(`Colaborador: ${experienceForm.engineerName}`, 20, 100);
      doc.setFont("helvetica", "bold");
      doc.text("EXPERIENCIA COMPARTIDA:", 20, 120);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(experienceForm.description, 170);
      doc.text(splitText, 20, 130);

      const pdfBlob = doc.output('blob');
      const fileName = `experience_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage.from('manuals').upload(fileName, pdfBlob);
      if (uploadError) throw uploadError;

      const { data: docData, error: dbError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: `Reporte Técnico: ${experienceForm.faultType || 'Experiencia de Campo'}`,
          file_type: 'pdf',
          brand: experienceForm.brand,
          storage_path: fileName,
          uploaded_by: experienceForm.engineerName
        })
        .select()
        .single();

      if (dbError) throw dbError;

      await handleReindex(docData, 'manuals');
      alert('¡Gracias! Tu experiencia ha sido documentada y compartida con el equipo.');
      setExperienceForm({ brand: 'NCR', model: '', faultType: '', location: '', description: '', engineerName: '' });
      fetchDocuments();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const getPublicUrl = (doc: any) => {
    const bucket = doc.file_type === 'pdf' ? 'manuals' : 'media';
    const { data } = supabase.storage.from(bucket).getPublicUrl(doc.storage_path);
    return data.publicUrl;
  };

  const handleDelete = async (doc: any) => {
    if (!window.confirm(`¿Eliminar permanentemente "${doc.title}"?`)) return;

    try {
      const bucket = doc.file_type === 'pdf' ? 'manuals' : 'media';
      await supabase.from('knowledge_chunks').delete().eq('document_id', doc.id);
      const { error: dbError } = await supabase.from('knowledge_documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;
      await supabase.storage.from(bucket).remove([doc.storage_path]);
      alert('Documento eliminado correctamente.');
      fetchDocuments();
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  return (
    <div suppressHydrationWarning className="max-w-6xl mx-auto space-y-8">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white tracking-wider uppercase flex items-center gap-3">
          <Database className="text-blue-500" />
          Base de Conocimiento Técnico
        </h1>
        <p className="mt-2 text-slate-400 text-sm tracking-wide">
          Gestiona manuales y experiencias colaborativas de campo.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Column 1: Ingestion */}
        <div className="space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-slate-200 uppercase tracking-wide mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              Ingestar Manuales
            </h2>
            <div className="space-y-6">
              <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-950 hover:bg-slate-900 hover:border-blue-500 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-slate-500" />
                    <p className="mb-2 text-xs text-slate-400 text-center px-4">
                      <span className="font-semibold text-blue-400">PDF, Imagen o Video</span>
                    </p>
                  </div>
                  <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} />
                </label>
              </div>

              {file && (
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-300 truncate max-w-[150px]">{file.name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors ${
                  !file || uploading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {uploading ? 'Ingestando vía IA...' : 'Subir y Procesar'}
              </button>

              {success && (
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-[10px] bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4" />
                  Indexado correctamente.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-slate-200 uppercase tracking-wide mb-6 flex items-center gap-2">
              <PenTool className="w-5 h-5 text-amber-500" />
              Compartir Experiencia
            </h2>
            <form onSubmit={handleShareExperience} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Marca</label>
                  <select value={experienceForm.brand} onChange={e => setExperienceForm({...experienceForm, brand: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500">
                    <option>NCR</option><option>Diebold</option><option>GRG</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Modelo</label>
                  <input type="text" placeholder="ej. 6622" value={experienceForm.model} onChange={e => setExperienceForm({...experienceForm, model: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Tipo de Falla</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input type="text" placeholder="ej. Error 12 de Dispensador" value={experienceForm.faultType} onChange={e => setExperienceForm({...experienceForm, faultType: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 pl-9 text-xs text-white focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Ubicación / Sitio</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input type="text" placeholder="ej. Sucursal Bancaria 402" value={experienceForm.location} onChange={e => setExperienceForm({...experienceForm, location: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 pl-9 text-xs text-white focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Experiencia Técnica</label>
                <textarea rows={4} placeholder="Describe qué encontraste y cómo lo solucionaste..." value={experienceForm.description} onChange={e => setExperienceForm({...experienceForm, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Nombre del Ingeniero (Crédito)</label>
                <input type="text" placeholder="Tu Nombre" value={experienceForm.engineerName} onChange={e => setExperienceForm({...experienceForm, engineerName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500" />
              </div>
              <button type="submit" disabled={isGenerating} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded-lg text-xs uppercase tracking-wider transition-all">
                {isGenerating ? 'Generando PDF...' : 'Subir Experiencia'}
              </button>
            </form>
          </div>
        </div>

        {/* Column 2: Document List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col h-[800px]">
          <h2 className="text-xl font-bold text-slate-200 uppercase tracking-wide mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            Corpus Técnico
          </h2>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {documents.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8 italic">Núcleo de memoria vacío. Esperando registros.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-start gap-4 hover:border-slate-700 transition-all group">
                  <div className={`p-3 rounded-lg ${doc.file_type === 'pdf' ? 'bg-blue-500/10' : 'bg-amber-500/10'}`}>
                    <FileText className={`w-6 h-6 ${doc.file_type === 'pdf' ? 'text-blue-400' : 'text-amber-500'}`} />
                  </div>
                  <div className="overflow-hidden flex-1">
                    <h4 className="text-sm font-bold text-slate-100 truncate pr-4 uppercase tracking-tight">{doc.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-black tracking-tighter shadow-sm ${
                        (doc.knowledge_chunks?.[0]?.count || 0) > 0
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}>
                        {(doc.knowledge_chunks?.[0]?.count || 0) > 0 ? 'Indexado' : 'Procesando'}
                      </span>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {doc.knowledge_chunks?.[0]?.count || 0} fragmentos  •  Por: <span className="text-slate-300">{doc.uploaded_by}</span>
                      </p>
                      <span className="text-[10px] text-slate-600 ml-auto">{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    <button onClick={() => handleReindex(doc)} disabled={doc.indexing} className={`p-2 rounded-lg text-slate-300 hover:text-white transition-all shadow-lg ${doc.indexing ? 'bg-blue-600 animate-pulse' : 'bg-slate-800 hover:bg-emerald-600'}`} title="Forzar Re-indexado IA">
                      <RotateCcw className={`w-4 h-4 ${doc.indexing ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setSelectedDoc(doc)} className="p-2 bg-slate-800 hover:bg-blue-600 rounded-lg text-slate-300 hover:text-white transition-all shadow-lg" title="Ver">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(doc)} className="p-2 bg-slate-800 hover:bg-rose-600 rounded-lg text-slate-300 hover:text-white transition-all shadow-lg" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
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
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 p-2 rounded">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm truncate max-w-md">{selectedDoc.title}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Documento {selectedDoc.file_type}</p>
                  </div>
                </div>

                <div suppressHydrationWarning className="flex items-center gap-2">
                  {/* OCR Buttons - show if content_text exists */}
                  {selectedDoc.content_text && (
                    <>
                      <button
                        suppressHydrationWarning
                        onClick={() => isSpeaking ? stopSpeaking() : speakOCR(selectedDoc.content_text)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                          isSpeaking
                            ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                        }`}
                      >
                        {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        <span suppressHydrationWarning>{isSpeaking ? 'Detener Lectura' : 'Lectura Inteligente'}</span>
                      </button>

                      <button
                        suppressHydrationWarning
                        onClick={() => { setOcrMode(!ocrMode); if (ocrMode) stopSpeaking(); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                          ocrMode
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/40'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                        <span suppressHydrationWarning>{ocrMode ? 'Cerrar OCR' : 'Ver Texto OCR'}</span>
                      </button>
                    </>
                  )}

                  <button
                    suppressHydrationWarning
                    onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body: document viewer + optional OCR panel */}
              <div className="flex-1 flex overflow-hidden">

                {/* Left: Document Viewer */}
                <div className={`transition-all duration-300 bg-slate-950 relative overflow-hidden ${ocrMode ? 'w-1/2' : 'w-full'}`}>
                  {selectedDoc.file_type === 'pdf' ? (
                    <iframe
                      suppressHydrationWarning
                      src={`${getPublicUrl(selectedDoc)}#toolbar=0`}
                      className="w-full h-full border-none"
                      title={selectedDoc.title}
                    />
                  ) : selectedDoc.file_type === 'image' ? (
                    <div suppressHydrationWarning className="w-full h-full flex items-center justify-center p-8">
                      <img suppressHydrationWarning src={getPublicUrl(selectedDoc)} alt={selectedDoc.title} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
                    </div>
                  ) : selectedDoc.file_type === 'video' ? (
                    <div suppressHydrationWarning className="w-full h-full flex items-center justify-center p-4">
                      <video suppressHydrationWarning src={getPublicUrl(selectedDoc)} controls className="max-w-full max-h-full rounded-lg shadow-xl" />
                    </div>
                  ) : (
                    <div suppressHydrationWarning className="w-full h-full flex items-center justify-center text-slate-500">
                      Visor no disponible para este tipo de archivo.
                    </div>
                  )}
                </div>

                {/* Right: OCR Reading Panel */}
                {ocrMode && (
                  <div className="w-1/2 border-l border-slate-800 flex flex-col bg-slate-950">
                    {/* OCR Panel Header */}
                    <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <AlignLeft className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Texto Extraído (OCR)</span>
                      </div>
                      <button
                        suppressHydrationWarning
                        onClick={() => isSpeaking ? stopSpeaking() : speakOCR(selectedDoc.content_text)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                          isSpeaking
                            ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                        }`}
                      >
                        {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span suppressHydrationWarning>{isSpeaking ? 'Detener Lectura' : 'Leer en Voz Alta'}</span>
                      </button>
                    </div>

                    {/* OCR Text Content */}
                    <div ref={ocrTextRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {selectedDoc.content_text ? (
                        <p className="text-slate-300 text-xs leading-7 whitespace-pre-wrap font-mono tracking-wide">
                          {selectedDoc.content_text}
                        </p>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                          <BookOpen className="w-10 h-10 text-slate-700" />
                          <div>
                            <p className="text-slate-500 text-xs font-bold">Sin texto extraído aún</p>
                            <p className="text-slate-600 text-[10px] mt-1">Usa el botón de re-indexado (↻) para procesar este archivo con el motor OCR.</p>
                          </div>
                          <button
                            onClick={() => { handleReindex(selectedDoc); setSelectedDoc(null); setOcrMode(false); }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                          >
                            Procesar con OCR
                          </button>
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
                  Abrir en pestaña nueva
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, Database, Eye, X, Trash2, PenTool, MapPin, Tag, RotateCcw, Volume2, VolumeX, BookOpen, AlignLeft, Image as ImageIcon, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';

interface KnowledgeDocument {
  id: string;
  title: string;
  file_type: 'pdf' | 'image' | 'video';
  brand: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  content_text?: string;
  knowledge_chunks?: { count: number }[];
  indexing?: boolean;
}

export default function KnowledgeBasePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

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
  const [experienceImage, setExperienceImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [activeTab, setActiveTab] = useState<'upload' | 'experience'>('upload');

  useEffect(() => {
    setMounted(true);
    fetchDocuments();
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*, knowledge_chunks(count)')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching documents:', error);
    else setDocuments(data || []);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Math.random()}.${fileExt}`;
      const bucket = fileExt === 'pdf' ? 'manuals' : 'media';
      const storagePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { data: docData, error: dbError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: file.name,
          file_type: fileExt === 'pdf' ? 'pdf' : (fileExt === 'mp4' ? 'video' : 'image'),
          brand: 'GENERIC',
          storage_path: storagePath,
          uploaded_by: 'system'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Trigger ingestion
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docData.id,
          bucket,
          path: storagePath,
          fileType: docData.file_type,
          title: docData.title
        })
      });

      setSuccess(true);
      setFile(null);
      fetchDocuments();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleExperienceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setExperienceImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleShareExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      let storagePath = '';
      if (experienceImage) {
        const fileExt = experienceImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { data, error: uploadError } = await supabase.storage
          .from('media')
          .upload(`experiences/${fileName}`, experienceImage);
        
        if (uploadError) throw uploadError;
        storagePath = data.path;
      }

      const pdf = new jsPDF();
      pdf.setFontSize(20);
      pdf.text('BITÁCORA DE FALLA TÉCNICA', 20, 20);
      pdf.setFontSize(12);
      pdf.text(`Marca: ${experienceForm.brand}`, 20, 40);
      pdf.text(`Modelo: ${experienceForm.model}`, 20, 50);
      pdf.text(`Falla: ${experienceForm.faultType}`, 20, 60);
      pdf.text(`Ubicación: ${experienceForm.location}`, 20, 70);
      pdf.text(`Ingeniero: ${experienceForm.engineerName}`, 20, 80);
      pdf.text('Descripción:', 20, 100);
      const lines = pdf.splitTextToSize(experienceForm.description, 170);
      pdf.text(lines, 20, 110);

      const pdfBlob = pdf.output('blob');
      const pdfFileName = `EXP_${Date.now()}.pdf`;
      const pdfPath = `experiences/${pdfFileName}`;

      const { error: pdfUploadError } = await supabase.storage
        .from('manuals')
        .upload(pdfPath, pdfBlob);

      if (pdfUploadError) throw pdfUploadError;

      const { error: dbError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: `Experiencia: ${experienceForm.faultType}`,
          file_type: 'pdf',
          brand: experienceForm.brand,
          storage_path: pdfPath,
          uploaded_by: experienceForm.engineerName
        });

      if (dbError) throw dbError;

      alert('Experiencia guardada y convertida a PDF exitosamente.');
      setExperienceForm({ brand: 'NCR', model: '', faultType: '', location: '', description: '', engineerName: '' });
      setExperienceImage(null);
      setImagePreview(null);
      fetchDocuments();
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error al guardar experiencia');
    } finally {
      setIsGenerating(false);
    }
  };

  const getPublicUrl = (doc: KnowledgeDocument) => {
    const bucket = doc.file_type === 'pdf' ? 'manuals' : 'media';
    const { data } = supabase.storage.from(bucket).getPublicUrl(doc.storage_path);
    return data.publicUrl;
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const speakOCR = (text: string) => {
    if (!synthRef.current) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 3000));
    utterance.lang = 'es-ES';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  };

  const handleDelete = async (doc: KnowledgeDocument) => {
    if (!confirm(`¿Estás seguro de eliminar "${doc.title}"?`)) return;
    try {
      const bucket = doc.file_type === 'pdf' ? 'manuals' : 'media';
      const { error: storageError } = await supabase.storage.from(bucket).remove([doc.storage_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('knowledge_documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;

      fetchDocuments();
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error al eliminar documento');
    }
  };

  return (
    <div suppressHydrationWarning className="max-w-6xl mx-auto space-y-6 md:space-y-10 pb-10">
      <header className="mb-4 md:mb-10 border-b border-slate-800 pb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-5 relative z-10">
          <div className="p-4 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-600/20">
            <Database className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase">
              Central de Inteligencia
            </h1>
            <p className="text-[10px] md:text-sm text-slate-500 uppercase font-black tracking-[0.2em] mt-1">
              Manuales Técnicos y Experiencias de Campo
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        {/* Mobile Tabs Selector */}
        <div className="lg:hidden flex p-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
          <button 
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'upload' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
          >
            <Upload className="w-4 h-4" /> Manuales
          </button>
          <button 
            onClick={() => setActiveTab('experience')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'experience' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'}`}
          >
            <PenTool className="w-4 h-4" /> Experiencias
          </button>
        </div>

        {/* Column 1: Forms (Responsive Tabs) */}
        <div className="space-y-8 lg:block">
          {/* Ingest Manuals */}
          <div className={`${activeTab !== 'upload' ? 'hidden lg:block' : 'block'} bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden group`}>
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 -translate-x-1/2" />
            
            <h2 className="text-xs font-black text-slate-100 uppercase tracking-[0.2em] mb-8 flex items-center gap-3 relative z-10">
              <Upload className="w-5 h-5 text-blue-400" />
              Ingestar Conocimiento
            </h2>

            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-52 border-2 border-slate-800 border-dashed rounded-3xl cursor-pointer bg-slate-950 hover:bg-slate-900 hover:border-blue-500/50 transition-all group/drop">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-slate-800 group-hover/drop:scale-110 group-hover/drop:bg-blue-600 transition-all">
                      <Upload className="w-8 h-8 text-slate-500 group-hover/drop:text-white" />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center px-6">
                      Suelte <span className="text-blue-400">PDF, JPG o MP4</span> aquí
                    </p>
                  </div>
                  <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} />
                </label>
              </div>

              {file && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-4 bg-blue-600/5 rounded-2xl border border-blue-500/20">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-300 truncate">{file.name}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                </motion.div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 ${
                  !file || uploading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                }`}
              >
                {uploading ? 'Procesando con IA...' : 'Ejecutar Ingesta'}
              </button>

              <AnimatePresence>
                {success && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 shadow-xl shadow-emerald-500/5">
                    <CheckCircle className="w-5 h-5" />
                    ¡Sincronización Exitosa!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Share Experience */}
          <div className={`${activeTab !== 'experience' ? 'hidden lg:block' : 'block'} bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <h2 className="text-xs font-black text-slate-100 uppercase tracking-[0.2em] mb-8 flex items-center gap-3 relative z-10">
              <PenTool className="w-5 h-5 text-amber-500" />
              Bitácora de Campo
            </h2>

            <form onSubmit={handleShareExperience} className="space-y-5 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Marca</label>
                  <select value={experienceForm.brand} onChange={e => setExperienceForm({...experienceForm, brand: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] font-bold text-white focus:outline-none focus:border-amber-500 transition-all appearance-none">
                    <option>NCR</option><option>Diebold</option><option>GRG</option><option>General</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Modelo</label>
                  <input type="text" placeholder="ej. 6622" value={experienceForm.model} onChange={e => setExperienceForm({...experienceForm, model: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] font-bold text-white focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-800" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Tipología de Error</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input type="text" placeholder="ej. Error 12 Pick Line" value={experienceForm.faultType} onChange={e => setExperienceForm({...experienceForm, faultType: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pl-12 text-[10px] font-bold text-white focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-800" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Relato Técnico</label>
                <textarea rows={4} placeholder="Protocolo de solución paso a paso..." value={experienceForm.description} onChange={e => setExperienceForm({...experienceForm, description: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] font-bold text-white focus:outline-none focus:border-amber-500 transition-all resize-none placeholder:text-slate-800" />
              </div>
              
              <div className="space-y-3">
                <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Evidencia Visual</label>
                {imagePreview ? (
                  <div className="relative w-full h-40 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <button 
                      type="button"
                      onClick={() => { setExperienceImage(null); setImagePreview(null); }}
                      className="absolute top-3 right-3 p-2 bg-rose-600 rounded-xl text-white hover:bg-rose-500 transition-all shadow-xl active:scale-90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-800 border-dashed rounded-3xl cursor-pointer bg-slate-950 hover:bg-slate-900 transition-all group/cam">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-slate-600 group-hover/cam:text-amber-400 group-hover/cam:scale-110 transition-all" />
                      <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Capturar Evidencia</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleExperienceImageChange} />
                  </label>
                )}
              </div>

              <button type="submit" disabled={isGenerating} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-5 px-6 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-2xl shadow-amber-900/40 active:scale-95 flex items-center justify-center gap-3">
                {isGenerating ? (
                  <>
                    <RotateCcw className="w-5 h-5 animate-spin" />
                    Sincronizando...
                  </>
                ) : 'Publicar en el Corpus'}
              </button>
            </form>
          </div>
        </div>

        {/* Column 2: Document List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl flex flex-col h-[600px] md:h-[800px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          
          <h2 className="text-xs font-black text-slate-100 uppercase tracking-[0.2em] mb-10 flex items-center gap-4 relative z-10">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
            Repositorio Técnico Central
          </h2>

          <div className="space-y-4 flex-1 overflow-y-auto pr-3 custom-scrollbar relative z-10">
            {documents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-4">
                <FileText className="w-16 h-16 text-slate-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Base de datos offline</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="p-5 bg-slate-950/50 border border-slate-800/80 rounded-3xl flex flex-col sm:flex-row items-center gap-6 hover:border-slate-600 transition-all group backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    {doc.file_type === 'pdf' ? <FileText className="w-20 h-20" /> : <ImageIcon className="w-20 h-20" />}
                  </div>

                  <div className={`p-4 rounded-2xl flex-shrink-0 shadow-xl ${doc.file_type === 'pdf' ? 'bg-blue-600/10 border border-blue-500/20' : 'bg-amber-600/10 border border-amber-500/20'}`}>
                    {doc.file_type === 'pdf' ? <FileText className="w-6 h-6 text-blue-400" /> : <ImageIcon className="w-6 h-6 text-amber-500" />}
                  </div>

                  <div className="flex-1 w-full text-center sm:text-left overflow-hidden">
                    <h4 className="text-xs md:text-sm font-black text-slate-100 truncate pr-0 md:pr-10 uppercase tracking-tight group-hover:text-blue-400 transition-colors">{doc.title}</h4>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                      <span className={`text-[8px] px-2 py-1 rounded-lg uppercase font-black tracking-widest shadow-sm border ${
                        (doc.knowledge_chunks?.[0]?.count || 0) > 0
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                        {(doc.knowledge_chunks?.[0]?.count || 0) > 0 ? 'ACTIVO (IA)' : 'PROCESANDO'}
                      </span>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">
                        <span className="text-slate-300">{(doc.knowledge_chunks?.[0]?.count || 0)} Frag.</span> • {doc.uploaded_by}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all sm:translate-x-4 group-hover:translate-x-0 relative z-20">
                    <button onClick={() => setSelectedDoc(doc)} className="flex-1 sm:flex-none p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-xl shadow-blue-900/20 active:scale-90" title="Visualizar">
                      <Eye className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(doc)} className="flex-1 sm:flex-none p-3 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-xl transition-all shadow-xl active:scale-90" title="Eliminar">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* === DOCUMENT VIEWER MODAL (MOBILE OPTIMIZED) === */}
      <AnimatePresence>
        {mounted && selectedDoc && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            suppressHydrationWarning
            className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 bg-slate-950/95 backdrop-blur-xl"
            onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-slate-900 w-full h-full sm:h-[90vh] sm:max-w-6xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl border-t border-slate-800 sm:border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950 flex-shrink-0">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`p-2 rounded-xl shrink-0 ${selectedDoc.file_type === 'pdf' ? 'bg-blue-600' : 'bg-amber-600'}`}>
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest truncate">{selectedDoc.title}</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{selectedDoc.brand} • {selectedDoc.file_type}</p>
                  </div>
                </div>
                
                <button
                  suppressHydrationWarning
                  onClick={() => { setSelectedDoc(null); setOcrMode(false); stopSpeaking(); }}
                  className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-colors active:scale-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 flex flex-col sm:flex-row overflow-hidden bg-slate-950 relative">
                {/* Document Area */}
                <div className={`flex-1 relative overflow-hidden transition-all duration-500 ${ocrMode ? 'hidden sm:block sm:w-1/2' : 'w-full'}`}>
                  {selectedDoc.file_type === 'pdf' ? (
                    <iframe
                      suppressHydrationWarning
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(getPublicUrl(selectedDoc))}&embedded=true`}
                      className="w-full h-full border-none invert brightness-90 contrast-125"
                      title={selectedDoc.title}
                    />
                  ) : (
                    <div suppressHydrationWarning className="w-full h-full flex items-center justify-center p-4">
                      <img suppressHydrationWarning src={getPublicUrl(selectedDoc)} alt={selectedDoc.title} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                    </div>
                  )}
                </div>

                {/* OCR Area (Full Screen on Mobile if active) */}
                {ocrMode && (
                  <div className="w-full sm:w-1/2 border-l border-slate-800 flex flex-col bg-slate-900 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <AlignLeft className="w-5 h-5 text-amber-500" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Transcripción de IA</span>
                      </div>
                      <button onClick={() => setOcrMode(false)} className="sm:hidden text-slate-500 font-bold text-xs">CERRAR</button>
                    </div>
                    <div ref={ocrTextRef} className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                      {selectedDoc.content_text ? (
                        <p className="text-slate-300 text-sm md:text-base leading-loose whitespace-pre-wrap font-medium">
                          {selectedDoc.content_text}
                        </p>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6">
                          <RotateCcw className="w-12 h-12 text-slate-800 animate-spin" />
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Extrayendo datos estructurales...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer (Controls) */}
              <div className="p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center gap-4 flex-shrink-0 pb-10 sm:pb-5">
                <button
                  onClick={() => setOcrMode(!ocrMode)}
                  className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-3 py-4 sm:py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${ocrMode ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  <AlignLeft className="w-5 h-5" />
                  {ocrMode ? 'Ocultar Texto' : 'Ver Texto OCR'}
                </button>
                
                {selectedDoc.content_text && (
                  <button
                    onClick={() => isSpeaking ? stopSpeaking() : speakOCR(selectedDoc.content_text || '')}
                    className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-3 py-4 sm:py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isSpeaking ? 'bg-rose-600 text-white shadow-xl animate-pulse' : 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/40'}`}
                  >
                    {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    {isSpeaking ? 'Detener Voz' : 'Lectura Inteligente'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

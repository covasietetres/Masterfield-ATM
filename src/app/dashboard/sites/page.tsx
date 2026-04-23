'use client';

import { useState, useEffect } from 'react';
import { MapPin, Search, Plus, Navigation, Trash2, Map } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface Site {
  id: string;
  name: string;
  location: string;
  how_to_get: string;
  created_at: string;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form state
  const [newSite, setNewSite] = useState({
    name: '',
    location: '',
    how_to_get: ''
  });

  const fetchSites = async (query = '') => {
    setLoading(true);
    let supabaseQuery = supabase
      .from('technical_sites')
      .select('*')
      .order('name', { ascending: true });

    if (query) {
      supabaseQuery = supabaseQuery.ilike('name', `%${query}%`);
    }

    const { data, error } = await supabaseQuery;
    if (!error && data) setSites(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSites(searchQuery);
  };

  const handleRegisterSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.name || !newSite.location) {
      alert('Nombre y Ubicación son obligatorios.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('technical_sites')
      .insert([newSite]);

    if (error) {
      alert('Error al registrar sitio: ' + error.message);
    } else {
      alert('Sitio registrado correctamente.');
      setNewSite({ name: '', location: '', how_to_get: '' });
      setIsAdding(false);
      fetchSites();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar este sitio?')) return;
    
    const { error } = await supabase
      .from('technical_sites')
      .delete()
      .eq('id', id);

    if (error) alert('Error al eliminar: ' + error.message);
    else fetchSites();
  };

  const getGoogleMapsUrl = (location: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 pb-10">
      <header className="mb-4 md:mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <Map className="w-6 h-6 md:w-8 md:h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-white tracking-tighter md:tracking-wider uppercase">
              Sitios Técnicos
            </h1>
            <p className="text-[10px] md:text-sm text-slate-500 uppercase font-bold tracking-[0.1em] mt-1">
              Catálogo de unidades y coordenadas
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 md:py-3 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-900/40 active:scale-95"
        >
          {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isAdding ? 'Cerrar Registro' : 'Registrar Nuevo Sitio'}
        </button>
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 mb-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Nueva Ficha Técnica
              </h2>

              <form onSubmit={handleRegisterSite} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Nombre Identificador</label>
                  <input 
                    type="text" 
                    placeholder="ej. BBVA REFORMA 222" 
                    value={newSite.name}
                    onChange={e => setNewSite({...newSite, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Punto de Enlace (Mapa)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                    <input 
                      type="text" 
                      placeholder="Dirección o Coordenadas GPS" 
                      value={newSite.location}
                      onChange={e => setNewSite({...newSite, location: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl p-4 pl-12 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Protocolo de Acceso / Notas</label>
                  <textarea 
                    placeholder="Describe el acceso, horarios o contactos clave..." 
                    rows={4}
                    value={newSite.how_to_get}
                    onChange={e => setNewSite({...newSite, how_to_get: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all resize-none placeholder:text-slate-700"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/40 active:scale-95"
                  >
                    {loading ? 'Sincronizando...' : 'Guardar en Base de Datos'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-8 shadow-2xl min-h-[500px] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 -translate-x-1/2" />
        
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 relative z-10">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
            <Search className="w-4 h-4 text-blue-400" />
            Búsqueda de Unidades
          </h2>
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Escribe el nombre del sitio..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl p-4 pl-12 text-sm text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-700"
            />
          </form>
        </div>

        {loading && !sites.length ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin shadow-lg shadow-blue-500/20"></div>
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">Sincronizando Terminales...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 relative z-10">
            {sites.length === 0 ? (
              <div className="lg:col-span-2 text-center py-24">
                <div className="bg-slate-950/50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-800">
                  <MapPin className="w-10 h-10 text-slate-800" />
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No se encontraron coincidencias en el radar.</p>
              </div>
            ) : (
              sites.map((site) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={site.id} 
                  className="bg-slate-950/50 border border-slate-800/80 rounded-3xl p-5 md:p-6 hover:border-emerald-500/40 transition-all group relative overflow-hidden backdrop-blur-sm"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button 
                      onClick={() => handleDelete(site.id)}
                      className="p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-5">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4 rounded-2xl border border-emerald-500/10 group-hover:from-emerald-500 group-hover:to-emerald-600 transition-all duration-500 group-hover:scale-110">
                      <MapPin className="w-6 h-6 text-emerald-400 group-hover:text-white transition-colors" />
                    </div>
                    
                    <div className="space-y-5 flex-1 w-full">
                      <div className="pr-10 sm:pr-0">
                        <h3 className="text-white font-black uppercase tracking-tight text-lg md:text-xl group-hover:text-emerald-400 transition-colors">{site.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Navigation className="w-3 h-3 text-slate-600" />
                          <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{site.location}</p>
                        </div>
                      </div>
                      
                      {site.how_to_get && (
                        <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50 group-hover:bg-slate-900 transition-colors">
                          <p className="text-[9px] text-slate-400 uppercase font-black mb-2 flex items-center gap-2 tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Instrucciones de Arribo
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed italic font-medium">{site.how_to_get}</p>
                        </div>
                      )}

                      <a 
                        href={getGoogleMapsUrl(site.location)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/30 active:scale-95"
                      >
                        <Map className="w-4 h-4" />
                        Navegar con Google Maps
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

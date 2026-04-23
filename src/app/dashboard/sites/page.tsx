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
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wider uppercase flex items-center gap-3">
            <Map className="text-emerald-500" />
            Sitios Técnicos
          </h1>
          <p className="mt-2 text-slate-400 text-sm tracking-wide">
            Registro y ubicación de sitios para ingeniería de campo.
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
        >
          {isAdding ? <Navigation className="w-4 h-4 rotate-45" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'Cancelar' : 'Nuevo Sitio'}
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Registrar Nuevo Sitio
              </h2>
              <form onSubmit={handleRegisterSite} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Nombre del Sitio</label>
                  <input 
                    type="text" 
                    placeholder="ej. Sucursal BBVA Reforma" 
                    value={newSite.name}
                    onChange={e => setNewSite({...newSite, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Ubicación (Dirección o Coordenadas)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="ej. 19.4326, -99.1332 o Calle Falsa 123" 
                      value={newSite.location}
                      onChange={e => setNewSite({...newSite, location: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-11 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] text-slate-500 uppercase font-bold px-1">¿Cómo llegar?</label>
                  <textarea 
                    placeholder="ej. Entrar por el estacionamiento lateral, subir al piso 2..." 
                    rows={3}
                    value={newSite.how_to_get}
                    onChange={e => setNewSite({...newSite, how_to_get: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg"
                  >
                    {loading ? 'Registrando...' : 'Confirmar Registro'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[500px]">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <h2 className="text-xl font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Explorar Sitios
          </h2>
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar por nombre..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-11 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
            />
          </form>
        </div>

        {loading && !sites.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Sincronizando coordenadas...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sites.length === 0 ? (
              <div className="md:col-span-2 text-center py-20">
                <MapPin className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                <p className="text-slate-500 text-sm italic tracking-wide">No se encontraron sitios con ese nombre.</p>
              </div>
            ) : (
              sites.map((site) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={site.id} 
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/50 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleDelete(site.id)}
                      className="text-slate-600 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-500/10 p-3 rounded-xl shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                      <MapPin className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="space-y-4 flex-1">
                      <div>
                        <h3 className="text-white font-bold uppercase tracking-tight text-lg leading-none mb-1">{site.name}</h3>
                        <p className="text-[10px] text-slate-500 font-mono">{site.location}</p>
                      </div>
                      
                      {site.how_to_get && (
                        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50">
                          <p className="text-[10px] text-slate-400 uppercase font-black mb-1 flex items-center gap-1">
                            <Navigation className="w-3 h-3" /> Instrucciones
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed italic">{site.how_to_get}</p>
                        </div>
                      )}

                      <a 
                        href={getGoogleMapsUrl(site.location)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                      >
                        <Map className="w-3.5 h-3.5" />
                        Ver en Google Maps
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Supplier } from '../types';
import RecommendedSuppliersGallery from '../components/RecommendedSuppliersGallery';
import { IconStar, IconCheck } from '../components/Icons';
import { Link as LinkIcon } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function Suppliers() {
  const { push } = useNotifications();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [linkedIds, setLinkedIds] = useState<number[]>([]);

  const load = () => api<Supplier[]>('/suppliers').then(setSuppliers).catch(console.error);

  useEffect(() => {
    load();
    const stored = localStorage.getItem('xupply_linked_suppliers');
    if (stored) {
      try {
        setLinkedIds(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  const toggleLink = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    let newLinked;
    if (linkedIds.includes(id)) {
      newLinked = linkedIds.filter(i => i !== id);
      push({ message: 'Proveedor desvinculado de tu catálogo', at: new Date().toISOString() });
    } else {
      newLinked = [...linkedIds, id];
      push({ message: 'Proveedor vinculado. Sus productos ya aparecen en tu mercado.', at: new Date().toISOString() });
    }
    setLinkedIds(newLinked);
    localStorage.setItem('xupply_linked_suppliers', JSON.stringify(newLinked));
    window.dispatchEvent(new Event('xupply_linked_suppliers_changed'));
  };

  const groupedSuppliers = suppliers.reduce((acc, s) => {
    const cat = s.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, Supplier[]>);

  return (
    <div className="space-y-8 pb-12">
      <RecommendedSuppliersGallery />

      <div>
        <h2 className="mb-6 text-2xl font-extrabold text-slate-800 dark:text-slate-100">Directorio de Proveedores por Categoría</h2>
        
        {Object.entries(groupedSuppliers).map(([category, items]) => (
          <div key={category} className="mb-10">
            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              {category}
            </h3>
            <div className="flex flex-col gap-5">
              {items.map((s) => {
                const isLinked = linkedIds.includes(s.id);
                // Fallback realistic images for horizontal banners based on category
                const defaultImage = category === 'Carnes' 
                  ? 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=1200'
                  : category === 'Vegetales' 
                    ? 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200' 
                    : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1200';
                
                const coverImage = s.cover_url || defaultImage;

                return (
                  <Link 
                    to={`/comercio/supplier/${s.id}`} 
                    key={s.id} 
                    className={`relative w-full h-48 sm:h-56 md:h-64 rounded-3xl overflow-hidden group border ${isLinked ? 'border-emerald-500 shadow-emerald-500/20 shadow-xl' : 'border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl'}`}
                  >
                    <img src={coverImage} alt={s.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/20 to-transparent"></div>
                    
                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="max-w-xl">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-xs font-bold text-slate-200 mb-3">
                            <IconStar className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            {Number(s.rating).toFixed(1)}/5
                          </span>
                          <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-md mb-2">{s.name}</h3>
                          <p className="text-slate-300 font-medium line-clamp-1">{s.description || 'Proveedor de insumos para el sector gastronómico.'}</p>
                          <p className="text-sm text-slate-400 mt-1">{s.city ?? 'Bucaramanga, Santander'}</p>
                        </div>
                        
                        <div className="flex gap-3 shrink-0">
                          <button
                            onClick={(e) => toggleLink(e, s.id)}
                            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all backdrop-blur-md ${
                              isLinked 
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30' 
                                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                            }`}
                            title={isLinked ? 'Desvincular' : 'Vincular'}
                          >
                            {isLinked ? <><IconCheck className="w-4 h-4" /> Vinculado</> : <><LinkIcon className="w-4 h-4" /> Vincular</>}
                          </button>
                          <div className="flex items-center justify-center px-6 py-3 bg-brand hover:bg-sky-500 text-white rounded-xl font-bold transition-colors">
                            Ver Perfil
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
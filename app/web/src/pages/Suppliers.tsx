import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Supplier, Review } from '../types';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';
import { formatDate } from '../lib/constants';
import RecommendedSuppliersGallery from '../components/RecommendedSuppliersGallery';
import { IconStar, IconCheck } from '../components/Icons';
import { Link as LinkIcon, Unlink } from 'lucide-react';

export default function Suppliers() {
  const { push } = useNotifications();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  
  // Local storage vinculations
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

  const toggleLink = (id: number) => {
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
    
    // Disparar evento para que el módulo de Mercado (Catálogo) pueda recargar si está montado
    window.dispatchEvent(new Event('xupply_linked_suppliers_changed'));
  };

  const open = async (s: Supplier) => {
    setSelected(s);
    setRating(5);
    setComment('');
    api<Review[]>(`/reviews?supplier_id=${s.id}`).then(setReviews).catch(() => setReviews([]));
  };

  const submitReview = async () => {
    if (!selected) return;
    try {
      await api('/reviews', {
        method: 'POST',
        body: JSON.stringify({ supplier_id: selected.id, rating, comment }),
      });
      push({ message: 'Reseña publicada', at: new Date().toISOString() });
      setSelected(null);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Group suppliers by category
  const groupedSuppliers = suppliers.reduce((acc, s) => {
    const cat = s.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, Supplier[]>);

  return (
    <div className="space-y-8">
      <RecommendedSuppliersGallery />

      <div>
        <h2 className="mb-6 text-2xl font-extrabold text-slate-800 dark:text-slate-100">Directorio de Proveedores por Categoría</h2>
        
        {Object.entries(groupedSuppliers).map(([category, items]) => (
          <div key={category} className="mb-10">
            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              {category}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => {
                const isLinked = linkedIds.includes(s.id);
                return (
                  <div key={s.id} className={`rounded-2xl border ${isLinked ? 'border-brand shadow-sm bg-brand/5' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'} p-5 text-left transition-all hover:shadow-md flex flex-col justify-between`}>
                    <div>
                      <div className="mb-2 flex items-start justify-between">
                        <h3 className="font-bold text-lg leading-tight dark:text-white pr-2">{s.name}</h3>
                        <span className="rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 shrink-0">
                          <IconStar className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{Number(s.rating).toFixed(1)}</span>
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{s.city ?? 'Bucaramanga'}</p>
                    </div>
                    
                    <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => open(s)} 
                        className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 rounded-xl text-sm transition-colors text-center"
                      >
                        Ver Perfil
                      </button>
                      <button
                        onClick={() => toggleLink(s.id)}
                        className={`flex items-center justify-center gap-1.5 px-4 rounded-xl text-sm font-bold transition-all ${
                          isLinked 
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                            : 'bg-brand text-white hover:bg-sky-600'
                        }`}
                        title={isLinked ? 'Desvincular' : 'Vincular'}
                      >
                        {isLinked ? <><IconCheck className="w-4 h-4" /> Vinculado</> : <><LinkIcon className="w-4 h-4" /> Vincular</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="flex justify-end gap-2 mb-4">
            <button 
              onClick={() => toggleLink(selected.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
                linkedIds.includes(selected.id)
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-brand text-white hover:bg-sky-600 shadow-md shadow-brand/20'
              }`}
            >
              {linkedIds.includes(selected.id) ? <><Unlink className="w-4 h-4" /> Desvincular Proveedor</> : <><LinkIcon className="w-4 h-4" /> Vincular Proveedor</>}
            </button>
            <Link to={`/comercio/supplier/${selected.id}`} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              Perfil Completo
            </Link>
          </div>
          <div className="mb-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 text-sm">
            <p className="mb-2"><b className="text-slate-700 dark:text-slate-300">NIT:</b> <span className="text-slate-600 dark:text-slate-400">{selected.nit ?? '—'}</span></p>
            <p className="mb-2"><b className="text-slate-700 dark:text-slate-300">Email:</b> <span className="text-slate-600 dark:text-slate-400">{selected.email ?? '—'}</span></p>
            <p className="mb-2"><b className="text-slate-700 dark:text-slate-300">Teléfono:</b> <span className="text-slate-600 dark:text-slate-400">{selected.phone ?? '—'}</span></p>
            <p><b className="text-slate-700 dark:text-slate-300">Dirección:</b> <span className="text-slate-600 dark:text-slate-400">{selected.address ?? '—'}</span></p>
          </div>
          <h4 className="mb-3 text-base font-bold dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Reseñas ({selected.review_count})</h4>
          <div className="mb-6 max-h-48 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {reviews.length === 0 && <p className="text-sm text-slate-500 italic">Sin reseñas aún. ¡Sé el primero en calificar!</p>}
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <b className="dark:text-slate-200">{r.reviewer_name}</b>
                  <span className="text-amber-600 dark:text-amber-500 inline-flex items-center gap-1 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                    <IconStar className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{r.rating}</span>
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-1">{r.comment}</p>
                <p className="text-xs text-slate-400 mt-2">{formatDate(r.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 -mx-6 -mb-6 p-6 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
            <h4 className="font-bold text-sm dark:text-slate-200">Dejar una reseña</h4>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium dark:text-slate-400">Calificación:</span>
              <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-brand">
                <option value="5">5 - Excelente</option>
                <option value="4">4 - Muy bueno</option>
                <option value="3">3 - Regular</option>
                <option value="2">2 - Malo</option>
                <option value="1">1 - Pésimo</option>
              </select>
            </div>
            <textarea
              placeholder="¿Cómo fue tu experiencia con este proveedor?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              rows={3}
            />
            <button onClick={submitReview} className="w-full rounded-xl bg-brand py-2.5 font-bold text-white hover:bg-sky-600 transition shadow-md shadow-brand/20">
              Publicar Reseña
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
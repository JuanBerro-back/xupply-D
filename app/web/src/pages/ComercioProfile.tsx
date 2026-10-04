import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Review } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { IconStar, IconCheck } from '../components/Icons';
import { Link as LinkIcon, ArrowLeft } from 'lucide-react';
import { formatDate } from '../lib/constants';

export default function ComercioProfile() {
  const { type, id } = useParams();
  const { push } = useNotifications();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linkedIds, setLinkedIds] = useState<number[]>([]);
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchProfile();
    if (type === 'supplier') {
      fetchReviews();
      const stored = localStorage.getItem('xupply_linked_suppliers');
      if (stored) {
        try {
          setLinkedIds(JSON.parse(stored));
        } catch (e) {}
      }
    }
  }, [type, id]);

  const fetchProfile = async () => {
    try {
      if (type === 'supplier') {
        const profileRes = await api<any>(`/suppliers/${id}`);
        const catalogRes = await api<any[]>(`/products?supplier_id=${id}`);
        setData({ profile: profileRes, catalog: catalogRes || [] });
      } else {
        const profileRes = await api<any>(`/restaurants/${id}`);
        setData({ profile: profileRes, catalog: [] });
      }
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await api<Review[]>(`/reviews?supplier_id=${id}`);
      setReviews(res);
    } catch (err) {
      setReviews([]);
    }
  };

  const submitReview = async () => {
    if (!id) return;
    try {
      await api('/reviews', {
        method: 'POST',
        body: JSON.stringify({ supplier_id: Number(id), rating, comment }),
      });
      push({ message: 'Reseña publicada con éxito', at: new Date().toISOString() });
      setRating(5);
      setComment('');
      fetchReviews();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const toggleLink = () => {
    if (!id) return;
    const supId = Number(id);
    let newLinked;
    if (linkedIds.includes(supId)) {
      newLinked = linkedIds.filter(i => i !== supId);
      push({ message: 'Proveedor desvinculado', at: new Date().toISOString() });
    } else {
      newLinked = [...linkedIds, supId];
      push({ message: 'Proveedor vinculado. Ya puedes dejar una reseña.', at: new Date().toISOString() });
    }
    setLinkedIds(newLinked);
    localStorage.setItem('xupply_linked_suppliers', JSON.stringify(newLinked));
    window.dispatchEvent(new Event('xupply_linked_suppliers_changed'));
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Cargando perfil del comercio...</div>;
  if (!data || !data.profile) return <div className="p-8 text-center text-rose-500 font-bold">Comercio no encontrado</div>;

  const { profile, catalog } = data;
  const isSupplier = type === 'supplier';
  const isLinked = isSupplier && linkedIds.includes(Number(id));
  
  // Facebook style constants
  const defaultImage = profile.category === 'Carnes' 
    ? 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=1200'
    : profile.category === 'Vegetales' 
      ? 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200' 
      : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1200';
  
  const coverImage = profile.cover_url || defaultImage;
  const avatarImage = profile.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random&color=fff&size=150`;

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Cover Photo Area */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-b-3xl overflow-hidden shadow-sm bg-slate-200 dark:bg-slate-800">
        <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        
        {/* Back Button */}
        <button onClick={() => window.history.back()} className="absolute top-6 left-6 bg-white/20 backdrop-blur-md hover:bg-white/40 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
      </div>

      {/* Profile Header Info */}
      <div className="px-4 sm:px-8 relative -mt-16 sm:-mt-24 mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
          <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-full border-4 border-slate-50 dark:border-[#0b1120] overflow-hidden bg-white shadow-xl z-10 shrink-0">
            <img src={avatarImage} alt="Logo" className="w-full h-full object-cover" />
          </div>
          
          <div className="flex-1 text-center sm:text-left z-10 pb-2 sm:pb-4">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white drop-shadow-sm">{profile.name}</h1>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
              {isSupplier ? 'Proveedor Mayorista' : 'Restaurante'} • {profile.city || 'Ubicación Desconocida'}
            </p>
            {isSupplier && profile.rating && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-bold text-amber-700 dark:text-amber-400 mt-3">
                <IconStar className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                {Number(profile.rating).toFixed(1)}/5
              </span>
            )}
          </div>
          
          <div className="flex gap-2 z-10 pb-4">
            {isSupplier && (
              <button
                onClick={toggleLink}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                  isLinked 
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' 
                    : 'bg-brand text-white hover:bg-sky-600 shadow-brand/20'
                }`}
              >
                {isLinked ? <><IconCheck className="w-4 h-4" /> Vinculado</> : <><LinkIcon className="w-4 h-4" /> Vincular Proveedor</>}
              </button>
            )}
            <div className={`px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center ${profile.is_active ? 'bg-slate-100 text-emerald-600 dark:bg-slate-800' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
              {profile.is_active ? 'Activo' : 'Inactivo'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-4 sm:px-8">
        
        {/* Left Column: About & Reviews */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4">Información del Negocio</h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              {profile.description && (
                <p className="pb-4 border-b border-slate-100 dark:border-slate-800 leading-relaxed">{profile.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">NIT</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{profile.nit || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Teléfono</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{profile.phone || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Email</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{profile.email || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Dirección</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{profile.address || '—'}</p>
                </div>
                {isSupplier && profile.category && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Categoría</p>
                    <span className="inline-block bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg font-bold text-slate-700 dark:text-slate-300">
                      {profile.category}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isSupplier && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4">Reseñas ({reviews.length})</h2>
                
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {reviews.length === 0 && (
                    <div className="text-center py-6 text-slate-400 italic text-sm">
                      Aún no hay reseñas.
                    </div>
                  )}
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <b className="text-sm font-bold dark:text-slate-200">{r.reviewer_name}</b>
                        <span className="text-amber-600 dark:text-amber-500 inline-flex items-center gap-1 font-bold bg-amber-100/50 dark:bg-amber-900/20 px-2 py-0.5 rounded-lg text-xs">
                          <IconStar className="w-3.5 h-3.5 fill-amber-500" />
                          <span>{r.rating}</span>
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{r.comment}</p>
                      <p className="text-xs font-medium text-slate-400 mt-3">{formatDate(r.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {isLinked ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4">Dejar una reseña</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Calificación:</span>
                      <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold outline-none focus:border-brand">
                        <option value="5">5 - Excelente</option>
                        <option value="4">4 - Muy bueno</option>
                        <option value="3">3 - Regular</option>
                        <option value="2">2 - Malo</option>
                        <option value="1">1 - Pésimo</option>
                      </select>
                    </div>
                    <textarea
                      placeholder="Comparte tu experiencia con este proveedor..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none"
                      rows={3}
                    />
                    <button onClick={submitReview} className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white hover:bg-sky-600 transition shadow-lg shadow-brand/20">
                      Publicar Reseña
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/30 text-center">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-500">
                    Debes vincular a este proveedor para poder dejar una reseña.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Catalog / Menu */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
            <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              {isSupplier ? 'Catálogo de Productos' : 'Menú de Platos'}
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm px-3 py-1 rounded-full">{catalog.length}</span>
            </h2>
            
            {catalog.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl opacity-50">📦</span>
                </div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Sin productos publicados</h3>
                <p className="text-sm text-slate-500 max-w-sm">Este comercio aún no ha agregado productos a su catálogo público.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {catalog.map((item: any) => (
                  <div key={item.id} className="group border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 transition-all bg-white dark:bg-slate-900 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                    <div>
                      <span className="inline-block text-xs font-bold text-brand bg-brand/10 dark:bg-brand/20 px-2 py-1 rounded-md mb-2">
                        {item.category_name || item.category || 'Sin Categoría'}
                      </span>
                      <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">{item.name}</h3>
                      {item.description && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{item.description}</p>}
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Precio por {item.unit}</span>
                        <span className="font-black text-xl text-slate-800 dark:text-slate-100">
                          ${Number(isSupplier ? item.price_per_unit : item.price).toLocaleString()}
                        </span>
                      </div>
                      {isSupplier && (
                        <div className="text-right flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Min.</span>
                          <span className="font-bold text-slate-600 dark:text-slate-300">{item.min_order_qty}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

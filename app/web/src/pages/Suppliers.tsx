import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Supplier, Review } from '../types';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';
import { formatDate } from '../lib/constants';
import RecommendedSuppliersGallery from '../components/RecommendedSuppliersGallery';
import { IconStar } from '../components/Icons';

export default function Suppliers() {
  const { push } = useNotifications();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const load = () => api<Supplier[]>('/suppliers').then(setSuppliers).catch(console.error);

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="space-y-6">
      <RecommendedSuppliersGallery />

      <div>
        <h2 className="mb-4 text-xl font-bold">Directorio General de Proveedores</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <button key={s.id} onClick={() => open(s)} className="rounded-lg border bg-white p-4 text-left shadow-sm hover:shadow">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">{s.name}</h3>
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800 inline-flex items-center gap-1">
                <IconStar className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{Number(s.rating).toFixed(1)}</span>
              </span>
            </div>
            <p className="text-sm text-gray-500">{s.category ?? 'General'} · {s.city ?? 'Bucaramanga'}</p>
            <p className="mt-2 text-xs text-gray-400">{s.review_count} reseña(s)</p>
          </button>
        ))}
        </div>
      </div>

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="flex justify-end mb-3">
            <Link to={`/comercio/supplier/${selected.id}`} className="px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-sm font-bold hover:bg-brand/20 transition">
              Visitar Perfil Completo
            </Link>
          </div>
          <div className="mb-4 rounded bg-gray-50 p-3 text-sm">
            <p><b>NIT:</b> {selected.nit ?? '—'}</p>
            <p><b>Email:</b> {selected.email ?? '—'}</p>
            <p><b>Teléfono:</b> {selected.phone ?? '—'}</p>
            <p><b>Dirección:</b> {selected.address ?? '—'}</p>
          </div>
          <h4 className="mb-2 text-sm font-semibold">Reseñas</h4>
          <div className="mb-4 max-h-40 space-y-2 overflow-y-auto">
            {reviews.length === 0 && <p className="text-sm text-gray-500">Sin reseñas aún.</p>}
            {reviews.map((r) => (
              <div key={r.id} className="rounded border p-2 text-sm">
                <div className="flex justify-between">
                  <b>{r.reviewer_name}</b>
                  <span className="text-yellow-600 inline-flex items-center gap-1 font-bold">
                    <IconStar className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{r.rating}</span>
                  </span>
                </div>
                <p className="text-gray-600">{r.comment}</p>
                <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Calificación</label>
              <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full rounded border px-3 py-2">
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r} / 5 Estrellas</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Comentario</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" rows={3} />
            </div>
            <button onClick={submitReview} className="w-full rounded bg-brand py-2 text-white">Publicar reseña</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
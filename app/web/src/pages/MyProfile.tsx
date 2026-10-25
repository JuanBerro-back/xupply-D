import { toast } from '../lib/feedback';
import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function MyProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { push } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    nit: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    department: '',
    category: '',
    description: '',
    logo_url: '',
    cover_url: '',
  });

  const isSupplier = user?.role === 'proveedor_admin';
  const endpoint = isSupplier ? '/suppliers/me' : '/restaurants/me';

  useEffect(() => {
    api(endpoint)
      .then((data: any) => {
        setForm({
          name: data.name || '',
          nit: data.nit || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          city: data.city || '',
          department: data.department || '',
          category: data.category || '',
          description: data.description || '',
          logo_url: data.logo_url || '',
          cover_url: data.cover_url || '',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(endpoint, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      push({ message: 'Perfil actualizado exitosamente.', at: new Date().toISOString() });
      if (localStorage.getItem('xupply_new_user')) {
        localStorage.removeItem('xupply_new_user');
        navigate('/inventario');
      }
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const isNewUser = !!localStorage.getItem('xupply_new_user');

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Cargando perfil...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {isNewUser && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xl">🎉</span>
          </div>
          <div>
            <h2 className="font-black text-lg">¡Bienvenido a Xupply!</h2>
            <p className="text-sm font-medium mt-1 opacity-90">
              Has creado tu cuenta con éxito. Ahora, completa la información de tu negocio para que otros puedan encontrarte. Al guardar, te llevaremos a configurar tu inventario.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Perfil del Negocio</h1>
          <p className="text-sm text-slate-500 mt-1">Personaliza la información pública de tu {isSupplier ? 'distribuidora' : 'restaurante'}.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">Nombre del Negocio *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">NIT o Documento</label>
              <input value={form.nit} onChange={e => setForm({...form, nit: e.target.value})} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">Teléfono</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">Correo Público</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">Dirección Física</label>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">Ciudad</label>
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">Categoría</label>
              <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">Descripción</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition resize-none" placeholder="Breve descripción de tu negocio..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">URL del Logo</label>
              <input value={form.logo_url} onChange={e => setForm({...form, logo_url: e.target.value})} placeholder="https://..." className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">URL de Portada</label>
              <input value={form.cover_url} onChange={e => setForm({...form, cover_url: e.target.value})} placeholder="https://..." className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 outline-none transition" />
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button type="submit" disabled={saving} className="bg-brand hover:bg-brand-dark active:scale-95 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-brand/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
              {saving ? 'Guardando...' : (isNewUser ? 'Guardar y Continuar al Inventario' : 'Guardar Cambios')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

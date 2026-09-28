import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function ComercioProfile() {
  const { type, id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [type, id]);

  const fetchProfile = async () => {
    try {
      const res = await api<any>(`/admin/comercios/${type}/${id}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando perfil...</div>;
  if (!data || !data.profile) return <div className="p-8 text-center text-rose-500">Comercio no encontrado</div>;

  const { profile, catalog } = data;
  const isSupplier = type === 'supplier';
  
  // Facebook style constants
  const coverImage = profile.cover_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1000';
  const avatarImage = profile.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random&color=fff&size=150`;

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Cover Photo Area */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-b-2xl overflow-hidden shadow-sm bg-slate-200 dark:bg-slate-800">
        <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        
        {/* Back Button */}
        <Link to="/admin/comercios" className="absolute top-4 left-4 bg-white/20 backdrop-blur-md hover:bg-white/40 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition">
          ← Volver
        </Link>
      </div>

      {/* Profile Header Info */}
      <div className="px-4 sm:px-8 relative -mt-16 sm:-mt-24 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-slate-50 dark:border-[#0b1120] overflow-hidden bg-white shadow-md z-10 shrink-0">
            <img src={avatarImage} alt="Logo" className="w-full h-full object-cover" />
          </div>
          
          <div className="flex-1 text-center sm:text-left z-10 pb-2 sm:pb-4">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white drop-shadow-sm">{profile.name}</h1>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
              {isSupplier ? 'Proveedor Mayorista' : 'Restaurante'} • {profile.city || 'Ubicación Desconocida'}
            </p>
          </div>
          
          <div className="flex gap-2 z-10 pb-4">
            <div className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${profile.is_active ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
              {profile.is_active ? 'Activo' : 'Inactivo'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-8">
        
        {/* Left Column: About & Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4">Información</h2>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {profile.description && (
                <p className="pb-3 border-b border-slate-100 dark:border-slate-800">{profile.description}</p>
              )}
              <p><strong>NIT:</strong> {profile.nit || 'No registrado'}</p>
              <p><strong>Teléfono:</strong> {profile.phone || 'No registrado'}</p>
              <p><strong>Email:</strong> {profile.email || 'No registrado'}</p>
              <p><strong>Dirección:</strong> {profile.address || 'No registrado'}</p>
              {isSupplier && profile.category && (
                <p><strong>Categoría:</strong> {profile.category}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Catalog / Menu */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4">
              {isSupplier ? 'Catálogo de Productos' : 'Menú de Platos'}
            </h2>
            
            {catalog.length === 0 ? (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No hay productos publicados.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {catalog.map((item: any) => (
                  <div key={item.id} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white">{item.name}</h3>
                    {item.description && <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>}
                    
                    <div className="mt-auto pt-2 flex items-center justify-between text-sm">
                      <span className="font-black text-brand">
                        ${Number(isSupplier ? item.price_per_unit : item.price).toLocaleString()} {isSupplier && <span className="text-xs text-slate-400 font-normal">/ {item.unit}</span>}
                      </span>
                      <span className="text-xs font-bold text-slate-400 bg-white dark:bg-slate-900 px-2 py-1 rounded-md shadow-sm border border-slate-100 dark:border-slate-800">
                        {item.category_name || item.category || 'Sin Categoría'}
                      </span>
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

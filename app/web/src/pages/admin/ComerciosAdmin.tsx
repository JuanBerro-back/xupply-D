import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { IconSuppliers } from '../../components/Icons';
import { Link } from 'react-router-dom';

function IconRestaurant({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V10l-7-4-7 4v11h4v-6h6v6h4z" />
    </svg>
  );
}

export default function ComerciosAdmin() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'restaurantes' | 'proveedores'>('restaurantes');

  useEffect(() => {
    fetchComercios();
  }, []);

  const fetchComercios = async () => {
    setLoading(true);
    try {
      const [restRes, suppRes] = await Promise.all([
        api<any[]>('/admin/restaurants'),
        api<any[]>('/admin/suppliers'),
      ]);
      setRestaurants(restRes);
      setSuppliers(suppRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const list = activeTab === 'restaurantes' ? restaurants : suppliers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">Directorio de Comercios</h1>
        <p className="text-sm text-slate-500">
          Administra los perfiles y accesos de los restaurantes y proveedores inscritos en la plataforma.
        </p>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          className={`pb-2 px-1 font-bold text-sm ${activeTab === 'restaurantes' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('restaurantes')}
        >
          <span className="flex items-center gap-2">
            <IconRestaurant className="w-4 h-4" />
            Restaurantes ({restaurants.length})
          </span>
        </button>
        <button
          className={`pb-2 px-1 font-bold text-sm ${activeTab === 'proveedores' ? 'border-b-2 border-emerald-500 text-emerald-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('proveedores')}
        >
          <span className="flex items-center gap-2">
            <IconSuppliers className="w-4 h-4" />
            Proveedores ({suppliers.length})
          </span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Cargando comercios...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((c) => (
            <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-inner ${activeTab === 'restaurantes' ? 'bg-gradient-to-br from-brand to-orange-500' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{c.name}</h3>
                    <p className="text-xs text-slate-500 uppercase font-mono tracking-wider">NIT: {c.nit || 'N/A'}</p>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400'}`}>
                  {c.is_active ? 'ACTIVO' : 'INACTIVO'}
                </div>
              </div>
              
              <Link 
                to={`/comercio/${activeTab === 'restaurantes' ? 'restaurant' : 'supplier'}/${c.id}`}
                className="mt-auto block w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-center rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 transition"
              >
                Ver Perfil
              </Link>
            </div>
          ))}
          {list.length === 0 && (
            <div className="col-span-full p-8 text-center text-slate-500 border border-dashed border-slate-300 rounded-2xl dark:border-slate-700">
              No hay {activeTab} registrados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

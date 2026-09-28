import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';

interface Restaurant {
  id: number;
  name: string;
  category?: string;
  city?: string;
  is_active: boolean;
  logo_url?: string;
  description?: string;
}

export default function PosiblesClientes() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intentamos cargar de una ruta pública o general de restaurantes
    api<Restaurant[]>('/restaurants')
      .then(setRestaurants)
      .catch((err) => {
        console.error(err);
        // Fallback temporal si la ruta /restaurants no existe, intentar /admin/restaurants
        api<Restaurant[]>('/admin/restaurants')
          .then(setRestaurants)
          .catch(console.error);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-2xl font-black text-slate-800 dark:text-white">Posibles Clientes</h2>
        <p className="text-sm text-slate-500 mb-6">Directorio de restaurantes en la plataforma para ofrecer tus productos.</p>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando clientes...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col hover:shadow-md transition">
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center font-bold text-brand text-xl">
                    {r.logo_url ? <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" /> : r.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{r.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{r.category ?? 'Restaurante'} · {r.city ?? 'Ciudad'}</p>
                  </div>
                </div>
                
                {r.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2 flex-1">
                    {r.description}
                  </p>
                )}
                
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Link 
                    to={`/comercio/restaurant/${r.id}`} 
                    className="block w-full py-2 text-center rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-bold text-brand transition"
                  >
                    Ver Perfil
                  </Link>
                </div>
              </div>
            ))}
            {restaurants.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                No se encontraron restaurantes.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

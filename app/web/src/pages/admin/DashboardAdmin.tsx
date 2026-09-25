import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { IconTeam, IconStore, IconTruck } from '../../components/Icons';

export default function DashboardAdmin() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api('/admin/stats');
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando métricas...</div>;
  if (!stats) return <div className="p-8 text-center text-rose-500">Error cargando métricas</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">Panel de Control</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Resumen global de Xupply</p>
      </div>

      {/* Tarjetas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shrink-0">
            <IconTeam className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Usuarios Totales</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total_users}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <IconStore className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Restaurantes</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total_restaurants}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center shrink-0">
            <IconStore className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Sucursales</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total_branches}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center shrink-0">
            <IconTruck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Proveedores</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total_suppliers}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Desglose por Roles */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Usuarios por Rol</h2>
          <div className="space-y-3">
            {stats.users_by_role?.map((r: any) => (
              <div key={r.name} className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{r.name}</span>
                <span className="text-sm font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos Usuarios Registrados */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Usuarios Recientes</h2>
          <div className="space-y-3">
            {stats.recent_users?.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                <div className="h-10 w-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-sm uppercase shrink-0">
                  {u.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-slate-500 font-mono">@{u.username} · {u.role}</p>
                </div>
                <span className={`h-2 w-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} title={u.is_active ? 'Activo' : 'Inactivo'} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Permission {
  id: number;
  name: string;
  description: string;
  roles_count: string;
  created_at: string;
}

export default function PermisosAdmin() {
  const [groupedPerms, setGroupedPerms] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await api<{ list: Permission[], grouped: Record<string, Permission[]> }>('/admin/permissions');
      setGroupedPerms(p.grouped);
    } catch (err: any) {
      setError(err.message || 'Error cargando permisos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">Catálogo de Permisos</h1>
          <p className="text-sm text-slate-500">Lista agrupada por módulos del sistema. Los permisos son solo de lectura.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400">Cargando catálogo...</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedPerms).map(([module, perms]) => (
            <div key={module} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">{module}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {perms.map(p => (
                  <div key={p.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400">ID: {p.id}</span>
                      <span className="text-[10px] font-bold bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                        Usado en {p.roles_count} rol(es)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

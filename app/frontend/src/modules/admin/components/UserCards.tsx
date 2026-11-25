import { Link } from 'react-router-dom';
import { AdminUser } from '../types';

export default function UserCards({
  users,
  loading,
  onViewDetail,
  onOpenForm,
  onToggleActive,
}: {
  users: AdminUser[];
  loading: boolean;
  onViewDetail: (id: number) => void;
  onOpenForm: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:hidden">
      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-dashed rounded-xl border-slate-300 dark:border-slate-700">No se encontraron usuarios</div>
      ) : (
        users.map(u => (
          <div key={u.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {u.name[0]}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{u.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">@{u.username} · {u.role_label}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                u.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                {u.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button onClick={() => onViewDetail(u.id)} className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">Detalle</button>
              {u.restaurant_id && <Link to={`/comercio/restaurant/${u.restaurant_id}`} className="text-[10px] font-semibold px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md">Perfil</Link>}
              {u.supplier_id && <Link to={`/comercio/supplier/${u.supplier_id}`} className="text-[10px] font-semibold px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md">Perfil</Link>}
              <button onClick={() => onOpenForm(u)} className="text-[10px] font-semibold px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md">Editar</button>
              <button onClick={() => onToggleActive(u)} className={`text-[10px] font-semibold px-2 py-1 rounded-md ${u.is_active ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30'}`}>{u.is_active ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { AdminUser } from '../types';

export default function UsersTable({
  users,
  loading,
  tenantNameOf,
  onViewDetail,
  onOpenForm,
  onResetPassword,
  onToggleActive,
  onDelete,
}: {
  users: AdminUser[];
  loading: boolean;
  tenantNameOf: (user: AdminUser) => string;
  onViewDetail: (id: number) => void;
  onOpenForm: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-extrabold text-slate-500 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-4 py-3">Usuario</th>
            <th className="px-4 py-3">Rol / Tenant</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr><td colSpan={4} className="text-center py-8">Cargando...</td></tr>
          ) : users.length === 0 ? (
            <tr><td colSpan={4} className="text-center py-8 text-slate-400">No se encontraron usuarios</td></tr>
          ) : (
            users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {u.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                      <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{u.role_label}</p>
                  <p className="text-[11px] text-slate-500">{tenantNameOf(u)}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    u.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button onClick={() => onViewDetail(u.id)} className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">Ver</button>
                  {u.restaurant_id && <Link to={`/comercio/restaurant/${u.restaurant_id}`} className="text-xs font-semibold px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50">Perfil</Link>}
                  {u.supplier_id && <Link to={`/comercio/supplier/${u.supplier_id}`} className="text-xs font-semibold px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50">Perfil</Link>}
                  <button onClick={() => onOpenForm(u)} className="text-xs font-semibold px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50">Edit</button>
                  <button onClick={() => onResetPassword(u)} className="text-xs font-semibold px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md">Clave</button>
                  <button onClick={() => onToggleActive(u)} className={`text-xs font-semibold px-2 py-1 rounded-md ${u.is_active ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{u.is_active ? 'Desactivar' : 'Activar'}</button>
                  <button onClick={() => onDelete(u.id)} className="text-xs font-semibold px-2 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-md">Eliminar</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

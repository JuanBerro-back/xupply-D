import VehicleBadge from '../../../../shared/ui/VehicleBadge';
import { TeamUser } from '../types';
import RoleBadge from './RoleBadge';

export default function DesktopUserTable({
  users,
  onEdit,
  onResetPassword,
  onDeactivate,
  onOpenLogistics,
}: {
  users: TeamUser[];
  onEdit: (user: TeamUser) => void;
  onResetPassword: (user: TeamUser) => void;
  onDeactivate: (user: TeamUser) => void;
  onOpenLogistics: () => void;
}) {
  return (
    <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-500 border-b">
          <tr>
            <th className="px-5 py-3.5">Usuario</th>
            <th className="px-5 py-3.5">Nombre</th>
            <th className="px-5 py-3.5">Rol</th>
            <th className="px-5 py-3.5">Vehículo</th>
            <th className="px-5 py-3.5">Contacto</th>
            <th className="px-5 py-3.5">Estado</th>
            <th className="px-5 py-3.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => {
            const isDom = u.role_id === 5 || u.role_name === 'domiciliario';

            return (
              <tr key={u.id} className="hover:bg-slate-50/80 transition">
                <td className="px-5 py-3.5 font-bold text-slate-900 font-mono text-xs">
                  {u.username}
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-800">{u.name}</div>
                  <div className="text-[11px] text-slate-400">{u.email || 'Sin correo'}</div>
                </td>
                <td className="px-5 py-3.5"><RoleBadge roleId={u.role_id} roleName={u.role_name} /></td>
                <td className="px-5 py-3.5">
                  {u.vehicle_type && u.vehicle_type !== 'ninguno' ? (
                    <VehicleBadge type={u.vehicle_type} plate={u.vehicle_plate} />
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-600">
                  {u.phone ? (
                    <a href={`tel:${u.phone}`} className="text-brand font-medium hover:underline inline-flex items-center gap-1">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{u.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {isDom && (
                      <button
                        onClick={onOpenLogistics}
                        className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-700 shadow-sm inline-flex items-center gap-1"
                        title="Ver en mapa GPS y asignar pedidos"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <span>Asignar Pedido</span>
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(u)}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onResetPassword(u)}
                      className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                    >
                      Clave
                    </button>
                    <button
                      onClick={() => onDeactivate(u)}
                      className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200"
                    >
                      {u.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium">
                No hay usuarios registrados en esta categoría
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

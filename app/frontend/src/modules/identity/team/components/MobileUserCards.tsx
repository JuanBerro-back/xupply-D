import VehicleBadge from '../../../../shared/ui/VehicleBadge';
import { TeamUser } from '../types';
import RoleBadge from './RoleBadge';

export default function MobileUserCards({
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
    <div className="grid grid-cols-1 gap-3 md:hidden">
      {users.map((u) => {
        const isDom = u.role_id === 5 || u.role_name === 'domiciliario';

        return (
          <div
            key={u.id}
            className={`rounded-2xl border p-4 shadow-sm bg-white transition ${
              isDom ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-lg ${
                    isDom
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-brand/10 text-brand'
                  }`}
                >
                  {u.name ? u.name[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">{u.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                  {u.vehicle_type && u.vehicle_type !== 'ninguno' && (
                    <div className="mt-1">
                      <VehicleBadge type={u.vehicle_type} plate={u.vehicle_plate} />
                    </div>
                  )}
                </div>
              </div>
              <RoleBadge roleId={u.role_id} roleName={u.role_name} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">TELÉFONO</span>
                {u.phone ? (
                  <a href={`tel:${u.phone}`} className="text-brand font-medium inline-flex items-center gap-1">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{u.phone}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">Sin teléfono</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">ESTADO</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    u.is_active ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  {u.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>

            {/* Botón destacado para Domiciliarios */}
            {isDom && (
              <div className="mt-3">
                <button
                  onClick={onOpenLogistics}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 text-white font-bold text-xs py-2 shadow-sm hover:from-sky-700 hover:to-sky-800 transition flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Asignar Pedido / Ver en Mapa GPS</span>
                </button>
              </div>
            )}

            {/* Acciones de Edición */}
            <div className="mt-3 flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => onEdit(u)}
                className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Editar
              </button>
              <button
                onClick={() => onResetPassword(u)}
                className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                Clave
              </button>
              <button
                onClick={() => onDeactivate(u)}
                className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                {u.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        );
      })}

      {users.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          <div className="h-8 w-8 mx-auto mb-2 text-slate-300 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="font-bold text-slate-800">No se encontraron usuarios</p>
          <p className="text-xs text-slate-400 mt-1">Prueba con otra pestaña o limpia el buscador.</p>
        </div>
      )}
    </div>
  );
}

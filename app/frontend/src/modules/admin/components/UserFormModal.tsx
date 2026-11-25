import { ChangeEvent, FormEvent } from 'react';
import Modal from '../../../shared/ui/Modal';
import { AdminUser, AdminUserFormState, Role, RoleScope, TenantOpt } from '../types';

export default function UserFormModal({
  form,
  editingUser,
  roles,
  restaurants,
  branches,
  suppliers,
  roleScope,
  selectedRole,
  onChange,
  onClose,
  onSubmit,
}: {
  form: AdminUserFormState;
  editingUser: AdminUser | null;
  roles: Role[];
  restaurants: TenantOpt[];
  branches: TenantOpt[];
  suppliers: TenantOpt[];
  roleScope: RoleScope;
  selectedRole?: Role;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      title={editingUser ? `Editar: ${editingUser.name}` : 'Crear Usuario'}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Username *</label>
            <input
              name="username" value={form.username} onChange={onChange} required disabled={!!editingUser}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm disabled:bg-slate-100 dark:disabled:bg-slate-900 dark:text-white"
            />
          </div>
          {!editingUser && (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Contraseña *</label>
              <input
                name="password" type="password" value={form.password} onChange={onChange} required minLength={8}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Nombre *</label>
            <input
              name="name" value={form.name} onChange={onChange} required
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Rol *</label>
            <select
              name="role_id" value={form.role_id} onChange={onChange} required
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
            >
              {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Correo</label>
            <input
              name="email" type="email" value={form.email} onChange={onChange}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Teléfono</label>
            <input
              name="phone" value={form.phone} onChange={onChange}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vinculación a Tenant</h4>

          {roleScope === 'platform' ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              {selectedRole?.name === 'verificador'
                ? 'El verificador es un rol de plataforma: revisa cuentas de todos los restaurantes y proveedores, no requiere restaurante ni proveedor.'
                : 'Este rol es de plataforma: no requiere restaurante ni proveedor.'}
            </p>
          ) : (
            <div className={`grid grid-cols-1 gap-3 ${roleScope === 'restaurant' ? 'sm:grid-cols-2' : ''}`}>
              {roleScope === 'restaurant' && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Restaurante *</label>
                    <select
                      name="restaurant_id" value={form.restaurant_id} onChange={onChange} required
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs dark:text-white"
                    >
                      <option value="">Selecciona un restaurante</option>
                      {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Sucursal</label>
                    <select
                      name="branch_id" value={form.branch_id} onChange={onChange} disabled={!form.restaurant_id}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50 dark:text-white"
                    >
                      <option value="">Ninguna</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {roleScope === 'supplier' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Proveedor *</label>
                  <select
                    name="supplier_id" value={form.supplier_id} onChange={onChange} required
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs dark:text-white"
                  >
                    <option value="">Selecciona un proveedor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vehículos para domiciliarios/etc */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vehículo (Opcional)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Tipo</label>
              <select
                name="vehicle_type" value={form.vehicle_type} onChange={onChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs dark:text-white"
              >
                <option value="ninguno">Ninguno</option>
                <option value="moto">Moto</option>
                <option value="camion">Camión</option>
                <option value="furgon">Furgón</option>
                <option value="camioneta">Camioneta</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Placa</label>
              <input
                name="vehicle_plate" value={form.vehicle_plate} onChange={onChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs uppercase dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
          <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-brand hover:bg-brand-dark rounded-xl">
            {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

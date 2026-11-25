import { FormEvent } from 'react';
import Modal from '../../../../shared/ui/Modal';
import { TeamFormState, TeamRoleOption, TeamUser } from '../types';

export default function TeamUserFormModal({
  form,
  editingUser,
  isSupplier,
  availableRoles,
  onChange,
  onClose,
  onSubmit,
}: {
  form: TeamFormState;
  editingUser: TeamUser | null;
  isSupplier: boolean;
  availableRoles: TeamRoleOption[];
  onChange: (patch: Partial<TeamFormState>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      title={
        editingUser
          ? `Editar ${isSupplier ? 'Domiciliario' : 'Empleado'}: ${editingUser.name}`
          : `Crear Nuevo ${isSupplier ? 'Domiciliario' : 'Empleado'}`
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        {!editingUser && (
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Nombre de Usuario (Login) *</label>
            <input
              value={form.username}
              onChange={(e) => onChange({ username: e.target.value })}
              placeholder={isSupplier ? 'ej. carlos_repartidor' : 'ej. juan_cocina'}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              required
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Nombre Completo *</label>
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="ej. Carlos Mendoza"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            required
          />
        </div>

        {!editingUser && (
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Contraseña *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => onChange({ password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              required
              minLength={6}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Teléfono Móvil (WhatsApp)</label>
            <input
              value={form.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="ej. 3151234567"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Correo Electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="ej. carlos@correo.com"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {availableRoles.length > 1 ? (
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Rol en la Organización *</label>
            <select
              value={form.role_id}
              onChange={(e) => onChange({ role_id: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
            >
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200">
            <span className="text-xs text-slate-500 font-semibold block">Rol Asignado:</span>
            <span className="text-xs font-bold text-slate-800">{availableRoles[0]?.label}</span>
          </div>
        )}

        {/* Asignación de Vehículo (Sólo para Proveedores / Domiciliarios) */}
        {isSupplier && (
          <div className="pt-2.5 border-t border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Asignación de Vehículo (Camión / Moto)</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Tipo de Vehículo</label>
                <select
                  value={form.vehicle_type}
                  onChange={(e) => onChange({ vehicle_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
                >
                  <option value="ninguno">Sin vehículo asignado</option>
                  <option value="moto">Moto (Motocicleta de reparto)</option>
                  <option value="camion">Camión (Carga pesada)</option>
                  <option value="furgon">Furgón (Carga seca / refrigerada)</option>
                  <option value="camioneta">Camioneta (Vehículo utilitario)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Placa del Vehículo</label>
                <input
                  value={form.vehicle_plate}
                  onChange={(e) => onChange({ vehicle_plate: e.target.value.toUpperCase() })}
                  placeholder="Ej: ABC-123"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-slate-200">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark active:scale-95 transition shadow-sm"
          >
            {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

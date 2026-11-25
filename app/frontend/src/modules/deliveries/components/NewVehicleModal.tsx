import Modal from '../../../shared/ui/Modal';
import { VehicleGlyph } from '../../../shared/ui/VehicleBadge';
import { DriverOption, VehicleFormState } from '../types';

export default function NewVehicleModal({
  form,
  drivers,
  onChange,
  onDriverChange,
  onCreate,
  onClose,
}: {
  form: VehicleFormState;
  drivers: DriverOption[];
  onChange: (patch: Partial<VehicleFormState>) => void;
  onDriverChange: (driverId: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Registrar Nuevo Vehículo (Camión / Moto)" onClose={onClose}>
      <div className="space-y-3.5">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">Tipo de Vehículo *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'camion', label: 'Camión', desc: 'Carga pesada' },
              { id: 'moto', label: 'Moto', desc: 'Repartos ágiles' },
              { id: 'furgon', label: 'Furgón', desc: 'Seco / Frío' },
              { id: 'camioneta', label: 'Camioneta', desc: 'Utilitario' },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onChange({ type: item.id })}
                className={`p-2.5 rounded-xl border text-left transition ${
                  form.type === item.id
                    ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <VehicleGlyph type={item.id} />
                  <span className="font-bold text-xs text-slate-800">{item.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 block">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Nombre o Identificador *</label>
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ej: Camión Norte 1, Moto Express 2"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Placa del Vehículo *</label>
          <input
            value={form.plate}
            onChange={(e) => onChange({ plate: e.target.value.toUpperCase() })}
            placeholder="Ej: ABC-123"
            className="w-full rounded-xl border px-3 py-2 text-sm font-mono uppercase"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Asignar a Usuario / Conductor:</label>
          <select
            value={form.driver_id}
            onChange={(e) => onDriverChange(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
          >
            <option value="">-- Sin conductor asignado (asignar luego) --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">IMEI del GPS (opcional):</label>
          <input
            value={form.imei}
            onChange={(e) => onChange({ imei: e.target.value })}
            placeholder="IMEI del GPS (15 dígitos, opcional)"
            className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
          />
        </div>

        <button
          onClick={onCreate}
          disabled={!form.name.trim() || !form.plate.trim()}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark shadow transition disabled:opacity-50"
        >
          Guardar y Registrar Vehículo
        </button>
      </div>
    </Modal>
  );
}

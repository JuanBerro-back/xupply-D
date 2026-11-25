import { Vehicle } from '../../../shared/types';
import Modal from '../../../shared/ui/Modal';
import { VehicleGlyph, vehicleLabel } from '../../../shared/ui/VehicleBadge';
import { DriverOption } from '../types';

export default function AssignVehicleModal({
  vehicle,
  drivers,
  driverId,
  onDriverChange,
  onConfirm,
  onClose,
}: {
  vehicle: Vehicle;
  drivers: DriverOption[];
  driverId: string;
  onDriverChange: (driverId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`Asignar Usuario a: ${vehicle.name} (${vehicle.plate})`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
            <VehicleGlyph type={vehicle.type} />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{vehicle.name}</p>
            <p className="text-xs text-slate-500">
              {vehicleLabel(vehicle.type)} · Placa: <b>{vehicle.plate}</b>
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Seleccionar Usuario / Domiciliario:</label>
          <select
            value={driverId}
            onChange={(e) => onDriverChange(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
          >
            <option value="">-- Sin conductor asignado --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onConfirm}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark shadow transition active:scale-95"
        >
          Confirmar Asignación Vehicular
        </button>
      </div>
    </Modal>
  );
}

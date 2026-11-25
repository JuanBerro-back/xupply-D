import { Vehicle } from '../../../shared/types';
import Modal from '../../../shared/ui/Modal';
import { DriverOption } from '../types';

export default function AssignDriverModal({
  orderCode,
  drivers,
  vehicles,
  selectedDriverId,
  selectedVehicleId,
  assignmentLoadError,
  onDriverChange,
  onVehicleChange,
  onAssign,
  onClose,
}: {
  orderCode: string;
  drivers: DriverOption[];
  vehicles: Vehicle[];
  selectedDriverId: string;
  selectedVehicleId: string;
  assignmentLoadError: string;
  onDriverChange: (driverId: string) => void;
  onVehicleChange: (vehicleId: string) => void;
  onAssign: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={`Asignar Domiciliario a ${orderCode}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Seleccionar domiciliario:</label>
          <select
            value={selectedDriverId}
            onChange={(e) => onDriverChange(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
          >
            <option value="">-- Elige un domiciliario --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.username}) {d.phone ? `· Tel: ${d.phone}` : ''}
              </option>
            ))}
          </select>
          {drivers.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">No hay domiciliarios activos registrados para este proveedor.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Vehículo para la entrega:</label>
          <select
            value={selectedVehicleId}
            onChange={(e) => onVehicleChange(e.target.value)}
            disabled={!selectedDriverId}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">-- Elige un vehículo --</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name} · {vehicle.plate} ({vehicle.type})
                {vehicle.driver_name ? ` · Conductor: ${vehicle.driver_name}` : ' · Sin conductor asignado'}
              </option>
            ))}
          </select>
          {assignmentLoadError ? (
            <p className="mt-1 text-xs text-red-600">{assignmentLoadError}</p>
          ) : vehicles.length === 0 ? (
            <p className="mt-1 text-xs text-amber-600">No hay vehículos activos en la flota. Registra un vehículo antes de asignar la entrega.</p>
          ) : null}
        </div>
        <button
          onClick={onAssign}
          disabled={!selectedDriverId || !selectedVehicleId || Boolean(assignmentLoadError)}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50 shadow transition"
        >
          Asignar y Notificar al Domiciliario
        </button>
      </div>
    </Modal>
  );
}

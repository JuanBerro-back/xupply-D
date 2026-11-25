import { Vehicle } from '../../../shared/types';
import { VehicleGlyph, vehicleLabel } from '../../../shared/ui/VehicleBadge';

export default function FleetPanel({
  vehicles,
  onNewVehicle,
  onAssignVehicle,
}: {
  vehicles: Vehicle[];
  onNewVehicle: () => void;
  onAssignVehicle: (vehicle: Vehicle) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Flota de Vehículos Registrados ({vehicles.length})</span>
          </h3>
          <p className="text-xs text-slate-500">
            Asigna camiones o motos a los usuarios y domiciliarios de tu equipo de entrega.
          </p>
        </div>
        <button
          onClick={onNewVehicle}
          className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark transition active:scale-95 shadow-xs flex items-center gap-1.5"
        >
          <span>+</span> Nuevo Vehículo
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 text-xs">
          No hay vehículos registrados en la flota. Pulsa "+ Nuevo Vehículo" para registrar camiones o motos.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {vehicles.map((v) => {
            const icon = <VehicleGlyph type={v.type} />;
            const typeLabel = vehicleLabel(v.type);
            return (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm hover:border-slate-300 transition space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center">
                      {icon}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">{v.name}</p>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {v.plate || 'SIN PLACA'}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 capitalize">
                    {typeLabel}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1 text-xs">
                  <div className="truncate">
                    <span className="text-slate-400 text-[11px]">Conductor: </span>
                    <span className="font-semibold text-slate-800 truncate">
                      {v.driver_name || 'Sin asignar'}
                    </span>
                  </div>
                  <button
                    onClick={() => onAssignVehicle(v)}
                    className="shrink-0 rounded-lg bg-white border border-brand/40 px-2.5 py-1 text-[11px] font-bold text-brand hover:bg-brand hover:text-white transition shadow-2xs"
                  >
                    Asignar Usuario
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

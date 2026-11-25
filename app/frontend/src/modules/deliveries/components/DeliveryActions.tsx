import { Delivery } from '../../../shared/types';
import { IconKey } from '../../../shared/ui/Icons';

export default function DeliveryActions({
  selected,
  isDriver,
  canManage,
  onStatusChange,
  onConfirm,
  onAssign,
}: {
  selected: Delivery;
  isDriver: boolean;
  canManage: boolean;
  onStatusChange: (id: number, status: string) => void;
  onConfirm: () => void;
  onAssign: () => void;
}) {
  return (
    <div className="space-y-2">
      {isDriver && (
        <div className="space-y-2">
          {selected.confirmation_code && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-2.5 text-center dark:border-amber-500/40 dark:bg-amber-500/10">
              <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                <IconKey className="h-3.5 w-3.5" /> Llave de seguridad
              </span>
              <div className="mt-1 inline-block rounded-lg border border-amber-200 bg-white px-3 py-1 font-mono text-xl font-black tracking-widest text-amber-950 shadow-sm">
                {selected.confirmation_code}
              </div>
              <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                Dicta este código al gerente para completar la entrega.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {selected.status === 'asignado' && (
              <button
                type="button"
                onClick={() => onStatusChange(selected.id, 'en_camino')}
                className="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-blue-700 active:scale-95"
              >
                Iniciar viaje
              </button>
            )}
            {selected.status === 'en_camino' && (
              <button
                type="button"
                onClick={() => onStatusChange(selected.id, 'llegando')}
                className="rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-white shadow transition hover:bg-amber-600 active:scale-95"
              >
                Estoy llegando al destino
              </button>
            )}
            {selected.status !== 'entregado' && (
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-emerald-700 active:scale-95"
              >
                Confirmar entrega con código
              </button>
            )}
          </div>
        </div>
      )}

      {canManage && (
        <button
          type="button"
          onClick={onAssign}
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-indigo-700 active:scale-95"
        >
          Asignar / cambiar domiciliario
        </button>
      )}
    </div>
  );
}

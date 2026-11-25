import { Delivery } from '../../../shared/types';
import { DELIVERY_STATUS, formatDate } from '../../../shared/utils/constants';

export default function DeliveryHistory({
  deliveries,
  canShowCodes,
  onSelect,
}: {
  deliveries: Delivery[];
  canShowCodes: boolean;
  onSelect: (delivery: Delivery) => void;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-bold text-slate-800 text-sm">Historial General de Entregas</h3>
      <div className="divide-y divide-slate-100">
        {deliveries.map((d) => {
          const st = DELIVERY_STATUS[d.status] ?? { label: d.status, color: 'bg-gray-100 text-gray-700' };
          return (
            <div
              key={d.id}
              onClick={() => onSelect(d)}
              className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 px-2 rounded-lg transition"
            >
              <div>
                <p className="font-bold text-sm text-slate-900">
                  {d.delivery_code} <span className="font-normal text-slate-500">· Pedido {d.order_code}</span>
                </p>
                <p className="text-xs text-slate-600">
                  {d.restaurant_name} · {d.delivery_address}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {d.driver_name ? `Conductor: ${d.driver_name}` : 'Sin conductor'}
                  {d.vehicle_name ? ` · Vehículo: ${d.vehicle_name} (${d.plate})` : ''}
                  {d.scheduled_time ? ` · Programada: ${formatDate(d.scheduled_time)}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.color}`}>{st.label}</span>
                {d.confirmation_code && canShowCodes && (
                  <p className="mt-1 text-xs text-slate-500 font-mono">
                    Código: <b>{d.confirmation_code}</b>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

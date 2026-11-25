import { Link } from 'react-router-dom';
import { ArrowUpDown, RefreshCw, Search, X } from 'lucide-react';
import { Delivery } from '../../../shared/types';
import { DELIVERY_STATUS } from '../../../shared/utils/constants';
import { formatDistance } from '../utils/geo';
import {
  calculateDistanceKm,
  destinationPositionFor,
  driverPositionFor,
} from '../utils/positions';

export default function DeliverySidePanel({
  activeCount,
  query,
  onQueryChange,
  sortBy,
  onSortToggle,
  onlyActive,
  onOnlyActiveChange,
  onRefresh,
  loadError,
  loading,
  deliveriesCount,
  visibleDeliveries,
  selectedId,
  isDriver,
  myCoords,
  canManage,
  pendingOrders,
  onSelect,
}: {
  activeCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  sortBy: 'cercanas' | 'recientes';
  onSortToggle: () => void;
  onlyActive: boolean;
  onOnlyActiveChange: (value: boolean) => void;
  onRefresh: () => void;
  loadError: string;
  loading: boolean;
  deliveriesCount: number;
  visibleDeliveries: Delivery[];
  selectedId?: number;
  isDriver: boolean;
  myCoords: { lat: number; lng: number } | null;
  canManage: boolean;
  pendingOrders: any[];
  onSelect: (delivery: Delivery) => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Entregas</h3>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          {activeCount} activa(s)
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar pedido, dirección..."
            aria-label="Buscar entregas"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs font-medium outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onSortToggle}
          className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Cambiar el orden de la lista"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortBy === 'cercanas' ? 'Cercanas' : 'Recientes'}
        </button>
      </div>

      <div className="mb-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => onOnlyActiveChange(true)}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
            onlyActive
              ? 'bg-brand text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Activas
        </button>
        <button
          type="button"
          onClick={() => onOnlyActiveChange(false)}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
            !onlyActive
              ? 'bg-brand text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Todas
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Actualizar"
        >
          <RefreshCw className="h-3 w-3" /> Actualizar
        </button>
      </div>

      {loadError && (
        <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {loadError}
        </div>
      )}

      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {loading && deliveriesCount === 0 && (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        )}

        {!loading && visibleDeliveries.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {query ? 'Sin resultados para tu búsqueda.' : 'No hay entregas para mostrar.'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {canManage
                ? 'Asigna un pedido para comenzar el seguimiento.'
                : 'Espera a que te asignen una entrega.'}
            </p>
          </div>
        )}

        {visibleDeliveries.map((delivery, index) => {
          const isCurrent = selectedId === delivery.id;
          const st = DELIVERY_STATUS[delivery.status] ?? DELIVERY_STATUS.asignado;
          const from = driverPositionFor(delivery, isDriver ? myCoords : null);
          const to = destinationPositionFor(delivery);
          const legDistance = from && to ? calculateDistanceKm(from, to) : null;

          return (
            <button
              key={delivery.id}
              type="button"
              onClick={() => onSelect(delivery)}
              className={`w-full rounded-xl border p-2.5 text-left transition ${
                isCurrent
                  ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-slate-900 dark:text-white">
                  {index === 0 && sortBy === 'cercanas' && !query && (
                    <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-extrabold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Siguiente
                    </span>
                  )}
                  <span className="truncate">{delivery.order_code}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {delivery.restaurant_name}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {delivery.delivery_address || 'Sin dirección'}
              </p>
              <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span className="truncate">{delivery.driver_name || 'Sin domiciliario'}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {legDistance != null ? formatDistance(legDistance) : 'sin GPS'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {pendingOrders.length > 0 && canManage && (
        <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <p className="mb-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
            Pedidos por asignar ({pendingOrders.length})
          </p>
          <div className="max-h-[140px] space-y-1.5 overflow-y-auto pr-0.5">
            {pendingOrders.map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-slate-900 dark:text-white">{po.order_code}</span>
                  <p className="truncate text-slate-500 dark:text-slate-400">{po.restaurant_name}</p>
                </div>
                <Link
                  to={`/pedidos/${po.id}`}
                  className="shrink-0 rounded-lg bg-brand px-2 py-1 text-[10px] font-bold text-white hover:bg-brand-dark"
                >
                  Asignar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

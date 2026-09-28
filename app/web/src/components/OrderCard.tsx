import { Link } from 'react-router-dom';
import { Order } from '../types';
import { ORDER_STATUS, formatMoney, formatDate } from '../lib/constants';

export default function OrderCard({ order, isSupplier }: { order: Order; isSupplier: boolean }) {
  const st = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-700' };
  return (
    <Link
      to={`/pedidos/${order.id}`}
      className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition hover:shadow-md dark:hover:border-slate-700"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800 dark:text-white">{order.order_code}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSupplier ? order.restaurant_name : order.supplier_name}
          </p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>
          <p className="mt-1 font-bold text-brand">{formatMoney(order.total)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
        <span>
          {formatDate(order.created_at)}
          {order.items?.length ? ` · ${order.items.length} producto(s)` : ''}
        </span>
        {['despachado', 'en_camino'].includes(order.status) && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
            En ruta GPS
          </span>
        )}
      </div>
    </Link>
  );
}
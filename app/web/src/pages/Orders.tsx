import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import { Order } from '../types';
import { ORDER_STATUS } from '../lib/constants';
import OrderCard from '../components/OrderCard';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isSupplier = user?.role === 'proveedor_admin';
  const isDriver = user?.role === 'domiciliario';

  const load = useCallback(() => {
    setError('');
    const qs = status ? `?status=${status}` : '';
    api<Order[]>(`/orders${qs}`)
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error(err);
        setError((err as Error).message || 'No se pudieron cargar los pedidos.');
      })
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => load();
    socket.on('order:created', refresh);
    socket.on('order:updated', refresh);
    return () => {
      socket.off('order:created', refresh);
      socket.off('order:updated', refresh);
    };
  }, [load]);

  const visibleOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      if (priceSort === 'asc') return Number(a.total) - Number(b.total);
      if (priceSort === 'desc') return Number(b.total) - Number(a.total);
      return 0;
    });
  }, [orders, priceSort]);

  const statuses = ['', 'nuevo', 'confirmado', 'preparando', 'despachado', 'en_camino', 'entregado', 'cancelado'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Pedidos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSupplier
              ? 'Pedidos que tus clientes te enviaron, en orden de llegada.'
              : isDriver
              ? 'Entregas asignadas a ti.'
              : 'Historial y estado de tus compras mayoristas.'}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="orders-status">
            Filtrar por estado
          </label>
          <select
            id="orders-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:flex-none"
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value === '' ? 'Todos los estados' : ORDER_STATUS[value]?.label ?? value}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="orders-sort">
            Ordenar por precio
          </label>
          <select
            id="orders-sort"
            value={priceSort}
            onChange={(event) => setPriceSort(event.target.value as 'asc' | 'desc' | '')}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:flex-none"
          >
            <option value="">Ordenar por precio</option>
            <option value="desc">Mayor a menor</option>
            <option value="asc">Menor a mayor</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-white/70 px-2.5 py-1 font-bold text-rose-700 transition hover:bg-white dark:bg-rose-500/20 dark:text-rose-200"
          >
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
            {status ? 'No hay pedidos con ese estado' : 'Todavía no hay pedidos'}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {status
              ? 'Prueba con otro estado o limpia el filtro.'
              : isSupplier
              ? 'Cuando un restaurante te compre, el pedido aparecerá aquí automáticamente.'
              : isDriver
              ? 'Cuando te asignen una entrega, la verás en tu ruta.'
              : 'Explora el catálogo mayorista y crea tu primer pedido.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {status ? (
              <button
                type="button"
                onClick={() => setStatus('')}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-dark"
              >
                Ver todos
              </button>
            ) : isDriver ? (
              <Link
                to="/repartidor"
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-dark"
              >
                Ir a mi ruta
              </Link>
            ) : isSupplier ? (
              <Link
                to="/"
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-dark"
              >
                Volver al panel
              </Link>
            ) : (
              <Link
                to="/catalogo"
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-dark"
              >
                Explorar catálogo
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} isSupplier={isSupplier} />
          ))}
        </div>
      )}

      {!loading && visibleOrders.length > 0 && (
        <p className="text-center text-[11px] text-slate-400">
          {visibleOrders.length} pedido(s) · se actualiza en tiempo real
        </p>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import { Order } from '../types';
import OrderCard from '../components/OrderCard';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | ''>('');

  const load = useCallback(() => {
    const qs = status ? `?status=${status}` : '';
    api<Order[]>(`/orders${qs}`).then(setOrders).catch(console.error);
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

  const isSupplier = user?.role === 'proveedor_admin';
  const statuses = ['', 'nuevo', 'confirmado', 'preparando', 'despachado', 'en_camino', 'entregado', 'cancelado'];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Pedidos</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-3 py-2 text-sm">
          {statuses.map((s) => (
            <option key={s} value={s}>{s === '' ? 'Todos los estados' : s}</option>
          ))}
        </select>
        <select value={priceSort} onChange={(e) => setPriceSort(e.target.value as any)} className="rounded border px-3 py-2 text-sm ml-2">
          <option value="">Ordenar por precio</option>
          <option value="desc">Mayor a menor</option>
          <option value="asc">Menor a mayor</option>
        </select>
      </div>
      {orders.length === 0 && <p className="text-gray-500">No hay pedidos.</p>}
      <div className="grid grid-cols-1 gap-4">
        {[...orders]
          .sort((a, b) => {
            if (priceSort === 'asc') return a.total - b.total;
            if (priceSort === 'desc') return b.total - a.total;
            return 0;
          })
          .map((o) => (
            <OrderCard key={o.id} order={o} isSupplier={isSupplier} />
          ))}
      </div>
    </div>
  );
}

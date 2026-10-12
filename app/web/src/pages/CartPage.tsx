import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../lib/api';
import { Order } from '../types';
import { formatMoney } from '../lib/constants';
import { getProductImage } from './Catalog';

export default function CartPage() {
  const { items, setQuantity, remove, total, clear } = useCart();
  const { push } = useNotifications();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const groupBySupplier = () => {
    const map = new Map<number, typeof items>();
    for (const i of items) {
      const list = map.get(i.product.supplier_id) ?? [];
      list.push(i);
      map.set(i.product.supplier_id, list);
    }
    return [...map.entries()];
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      for (const [supplierId, list] of groupBySupplier()) {
        const itemCustomizations = list
          .filter((i) => i.customization)
          .map((i) => `• ${i.product.name}: ${i.customization}`)
          .join('\n');
        const finalNotes = [notes.trim(), itemCustomizations ? `Personalizaciones:\n${itemCustomizations}` : '']
          .filter(Boolean)
          .join('\n\n');

        const order = await api<Order>('/orders', {
          method: 'POST',
          body: JSON.stringify({
            supplier_id: supplierId,
            notes: finalNotes,
            delivery_address: deliveryAddress,
            items: list.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
          }),
        });
        if (!order.id) throw new Error('No se pudo crear el pedido');
      }
      push({ message: `Pedido creado para ${groupBySupplier().length} proveedor(es)`, at: new Date().toISOString() });
      clear();
      navigate('/pedidos');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p className="mb-2 text-lg">Tu carrito está vacío</p>
        <button onClick={() => navigate('/catalogo')} className="rounded bg-brand px-4 py-2 text-white">Ir al catálogo</button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {groupBySupplier().map(([supplierId, list]) => (
          <div key={supplierId} className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-gray-800 border-b pb-2">{list[0].product.supplier_name}</h3>
            {list.map((i) => (
              <div key={i.product.id} className="mb-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={getProductImage(i.product)}
                    alt={i.product.name}
                    className="h-14 w-14 rounded-lg object-cover flex-shrink-0 border border-gray-100 shadow-xs"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{i.product.name}</p>
                    <p className="text-xs text-gray-500">{formatMoney(i.product.price_per_unit)} / {i.product.unit}</p>
                    {i.customization && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                        <span>⚙️</span> {i.customization}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto sm:ml-0">
                  <input
                    type="number"
                    min={1}
                    value={i.quantity}
                    onChange={(e) => setQuantity(i.product.id, Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded border px-2 py-1 text-center font-medium"
                  />
                  <span className="w-24 text-right font-semibold text-brand-dark">{formatMoney(i.product.price_per_unit * i.quantity)}</span>
                  <button onClick={() => remove(i.product.id)} className="text-sm text-red-500 hover:text-red-700">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="h-fit rounded-lg border bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold">Resumen</h3>
        <div className="mb-4 flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para el pedido" className="mb-2 w-full rounded border px-3 py-2 text-sm" rows={2} />
        <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Dirección de entrega" className="mb-4 w-full rounded border px-3 py-2 text-sm" />
        <button onClick={submit} disabled={submitting} className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          {submitting ? 'Creando pedido...' : 'Crear pedido'}
        </button>
      </div>
    </div>
  );
}
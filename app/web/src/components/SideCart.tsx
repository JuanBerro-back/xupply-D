import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../lib/api';
import { Order } from '../types';
import { formatMoney } from '../lib/constants';

export default function SideCart() {
  const { items, setQuantity, remove, total, count, isOpen, closeCart, clear } = useCart();
  const { push } = useNotifications();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const groupBySupplier = () => {
    const map = new Map<number, typeof items>();
    for (const i of items) {
      const list = map.get(i.product.supplier_id) ?? [];
      list.push(i);
      map.set(i.product.supplier_id, list);
    }
    return [...map.entries()];
  };

  const submitOrder = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const suppliers = groupBySupplier();
      for (const [supplierId, list] of suppliers) {
        const order = await api<Order>('/orders', {
          method: 'POST',
          body: JSON.stringify({
            supplier_id: supplierId,
            notes,
            delivery_address: deliveryAddress,
            items: list.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
          }),
        });
        if (!order.id) throw new Error('No se pudo generar el pedido con el proveedor');
      }
      push({
        message: `Pedido generado exitosamente para ${suppliers.length} proveedor(es)`,
        at: new Date().toISOString(),
      });
      clear();
      closeCart();
      navigate('/pedidos');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] overflow-hidden">
      {/* Telón de fondo con desenfoque suave */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6">
        <div className="relative w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Cabecera del Drawer */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Carrito de Compras</h2>
                <p className="text-xs text-slate-500">
                  {count} {count === 1 ? 'artículo' : 'artículos'} seleccionados
                </p>
              </div>
            </div>
            <button
              onClick={closeCart}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition"
              aria-label="Cerrar carrito"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Lista de Productos del Carrito */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-400">
                <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-300">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <p className="text-base font-bold text-slate-700">Tu carrito está vacío</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Agrega insumos desde el catálogo de proveedores para comenzar tu orden.
                </p>
                <button
                  onClick={() => {
                    closeCart();
                    navigate('/catalogo');
                  }}
                  className="mt-5 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-dark transition shadow-sm"
                >
                  Explorar Catálogo
                </button>
              </div>
            ) : (
              <>
                {groupBySupplier().map(([supplierId, list]) => (
                  <div key={supplierId} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      <h3 className="text-xs font-bold text-slate-800 truncate">
                        {list[0].product.supplier_name || 'Proveedor Oficial'}
                      </h3>
                      <span className="ml-auto text-[10px] text-slate-400 font-mono">
                        {list.length} {list.length === 1 ? 'ítem' : 'ítems'}
                      </span>
                    </div>

                    <div className="space-y-2.5 divide-y divide-slate-50">
                      {list.map((item) => (
                        <div key={item.product.id} className="pt-2 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{item.product.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {formatMoney(item.product.price_per_unit)} / {item.product.unit}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Selector de cantidad interactivo */}
                            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-1 py-0.5">
                              <button
                                type="button"
                                onClick={() => setQuantity(item.product.id, item.quantity - 1)}
                                className="h-6 w-6 rounded-lg bg-white text-slate-600 font-bold flex items-center justify-center hover:bg-slate-200 transition text-xs shadow-xs"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-xs font-bold text-slate-800">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuantity(item.product.id, item.quantity + 1)}
                                className="h-6 w-6 rounded-lg bg-white text-slate-600 font-bold flex items-center justify-center hover:bg-slate-200 transition text-xs shadow-xs"
                              >
                                +
                              </button>
                            </div>

                            <span className="w-16 text-right text-xs font-bold text-slate-800">
                              {formatMoney(item.product.price_per_unit * item.quantity)}
                            </span>

                            <button
                              type="button"
                              onClick={() => remove(item.product.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition"
                              title="Quitar producto"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Campos de Despacho y Notas */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-700">Detalles de Entrega</h4>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block mb-1">
                      Dirección de Envío
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Carrera 27 # 45-12, Bucaramanga"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block mb-1">
                      Instrucciones o Notas Especiales
                    </label>
                    <textarea
                      rows={2}
                      placeholder="ej. Entregar en recepción o llamar antes de llegar"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pie Fijo con Resumen y Botón de Confirmación */}
          {items.length > 0 && (
            <div className="border-t border-slate-200 bg-white p-4 space-y-3 shadow-lg">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal productos</span>
                  <span>{formatMoney(total)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Logística y transporte</span>
                  <span className="text-emerald-600 font-medium">Coordinado en ruta</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total estimado</span>
                  <span className="text-brand">{formatMoney(total)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className="w-full rounded-xl bg-brand py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-brand-dark active:scale-95 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Transmitiendo Pedido...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar y Despachar Pedido</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={closeCart}
                className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 text-center font-medium transition"
              >
                Continuar comprando
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
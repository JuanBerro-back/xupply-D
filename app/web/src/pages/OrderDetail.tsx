import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import { useNotifications } from '../context/NotificationContext';
import { Order } from '../types';
import { ORDER_STATUS, SUPPLIER_FLOW, formatMoney, formatDate } from '../lib/constants';
import Modal from '../components/Modal';
import { IconTruck, IconKey, IconCheck, IconEdit } from '../components/Icons';

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useNotifications();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<{ action: string; new_values: string; created_at: string }[]>([]);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [drivers, setDrivers] = useState<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: number; name: string; plate: string; type: string }[]>([]);
  const [securityKeyInput, setSecurityKeyInput] = useState('');
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  const completeWithKey = async (deliveryId: number) => {
    if (!securityKeyInput.trim()) {
      setKeyError('Por favor digita la llave de 4 dígitos proporcionada por el domiciliario');
      return;
    }
    setVerifyingKey(true);
    setKeyError('');
    try {
      await api(`/deliveries/${deliveryId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirmation_code: securityKeyInput.trim() }),
      });
      push({ message: '¡Envío completado exitosamente con la llave de entrega!', at: new Date().toISOString() });
      setSecurityKeyInput('');
      load();
    } catch (err) {
      setKeyError((err as Error).message);
    } finally {
      setVerifyingKey(false);
    }
  };

  const isGerente = user?.role === 'gerente';
  const isDriver = user?.role === 'domiciliario';
  const isSupplier = user?.role === 'proveedor_admin';
  const canManageDelivery = isSupplier || user?.role === 'admin';
  const [deliveryForm, setDeliveryForm] = useState({ vehicle_id: '', driver_id: '', scheduled_time: '' });

  const load = () => {
    api<Order>(`/orders/${id}`).then(setOrder).catch(console.error);
    api<{ action: string; new_values: string; created_at: string }[]>(`/orders/${id}/history`).then(setHistory).catch(() => undefined);
  };

  useEffect(() => {
    load();
    if (canManageDelivery) {
      api<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>('/deliveries/drivers').then(setDrivers).catch(() => undefined);
      api<{ id: number; name: string; plate: string; type: string }[]>('/deliveries/vehicles').then(setVehicles).catch(() => undefined);
    }
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = (o: Order) => {
      if (String(o.id) === String(id)) load();
    };
    socket.on('order:updated', onUpdate);
    return () => {
      socket.off('order:updated', onUpdate);
    };
  }, [id, canManageDelivery]);

  const changeStatus = async (status: string) => {
    try {
      await api<Order>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      push({ message: `Pedido actualizado → ${status}`, at: new Date().toISOString() });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const createDelivery = async () => {
    try {
      await api('/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          order_id: order!.id,
          vehicle_id: deliveryForm.vehicle_id ? Number(deliveryForm.vehicle_id) : null,
          driver_id: deliveryForm.driver_id ? Number(deliveryForm.driver_id) : null,
          scheduled_time: deliveryForm.scheduled_time || null,
          items: order!.items.map((i) => ({ product_name: i.name, quantity: i.quantity, unit: i.unit })),
        }),
      });
      push({ message: 'Entrega creada y asignada al domiciliario exitosamente', at: new Date().toISOString() });
      setDeliveryModal(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (!order) return <div className="py-10 text-center text-gray-500">Cargando pedido...</div>;

  const st = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-700' };
  const done = ['entregado', 'cancelado'].includes(order.status);
  const latestDelivery = order.deliveries && order.deliveries.length > 0 ? order.deliveries[0] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Link to="/pedidos" className="mb-3 inline-block text-sm text-brand hover:underline font-medium">← Volver a pedidos</Link>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors duration-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{order.order_code}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isSupplier ? order.restaurant_name : order.supplier_name} · {formatDate(order.created_at)}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${st.color}`}>{st.label}</span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Cantidad</th>
                <th className="py-2 text-right">Precio</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                  <td className="py-2">{i.name}</td>
                  <td className="py-2 text-right">{i.quantity} {i.unit}</td>
                  <td className="py-2 text-right">{formatMoney(i.unit_price)}</td>
                  <td className="py-2 text-right">{formatMoney(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end text-lg font-bold text-slate-900 dark:text-white">Total: {formatMoney(order.total)}</div>
          {order.notes && <p className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 p-2.5 text-sm text-slate-600 dark:text-slate-300">Notas: {order.notes}</p>}
          {order.delivery_address && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span><b>Dirección de entrega:</b> {order.delivery_address}</span>
            </p>
          )}
          {order.requested_delivery_date && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span><b>Entrega solicitada:</b> {formatDate(order.requested_delivery_date)}</span>
            </p>
          )}
        </div>

        {/* Tarjeta de seguimiento de entrega y domiciliario */}
        {latestDelivery && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
                  <IconTruck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Información y Estado de Entrega</h3>
                  <p className="text-xs text-slate-500 font-mono dark:text-slate-400">Guía: {latestDelivery.delivery_code}</p>
                </div>
              </div>
              <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white capitalize shadow-xs">
                {latestDelivery.status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
              <p>
                <b className="text-slate-900 dark:text-white">Ubicación de entrega:</b>{' '}
                <span className="text-slate-600 dark:text-slate-300">
                  {latestDelivery.delivery_address || order.delivery_address || 'Bucaramanga, Santander'}
                </span>
              </p>
              <p>
                <b className="text-slate-900 dark:text-white">Quién lo lleva (Domiciliario):</b>{' '}
                {latestDelivery.driver_name ? (
                  <span className="font-semibold text-sky-700 dark:text-sky-400">{latestDelivery.driver_name}</span>
                ) : (
                  <span className="text-amber-600 font-medium">Sin conductor asignado aún</span>
                )}
              </p>
              {latestDelivery.driver_phone && (
                <p><b className="text-slate-900 dark:text-white">Teléfono de contacto:</b> {latestDelivery.driver_phone}</p>
              )}
              {latestDelivery.vehicle_name && (
                <p><b className="text-slate-900 dark:text-white">Vehículo de despacho:</b> {latestDelivery.vehicle_name} ({latestDelivery.plate})</p>
              )}
            </div>

            {/* Domiciliario: Vista destacada de la llave de entrega */}
            {isDriver && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 shadow-xs dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200">
                <p className="font-bold text-xs sm:text-sm flex items-center gap-2">
                  <IconKey className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                  <span>
                    Tu Llave de Entrega:{' '}
                    <span className="font-mono text-base sm:text-lg font-black bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 rounded-lg shadow-sm">
                      {latestDelivery.confirmation_code || '----'}
                    </span>
                  </span>
                </p>
                <p className="text-[11px] mt-1.5 text-amber-800 dark:text-amber-300 leading-relaxed">
                  Entrega este código al gerente del restaurante al llegar para que complete la entrega en su sistema.
                </p>
              </div>
            )}

            {/* Gerente de Restaurante: Sección para validar con la llave recibida del domiciliario */}
            {(isGerente || (user?.restaurant_id && !isSupplier && !isDriver)) && (
              latestDelivery.status === 'entregado' ? (
                <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                  <IconCheck className="w-4 h-4 text-emerald-600" />
                  <span>Envío completado exitosamente a satisfacción con la llave de seguridad.</span>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/80 p-4 shadow-sm dark:bg-indigo-950/40 dark:border-indigo-800">
                  <div className="flex items-start gap-2 mb-2">
                    <IconKey className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                        Completar Envío con Llave de Seguridad
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        El domiciliario te entregará un código de 4 dígitos al momento de recibir el pedido. Ingrésalo a continuación para confirmar la recepción a satisfacción:
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 mt-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={securityKeyInput}
                      onChange={(e) => setSecurityKeyInput(e.target.value.trim())}
                      placeholder="Código (Ej: 7421)"
                      className="w-36 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-center text-sm font-black font-mono tracking-widest text-indigo-900 shadow-xs focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:text-white dark:border-indigo-700"
                    />
                    <button
                      type="button"
                      onClick={() => completeWithKey(latestDelivery.id)}
                      disabled={verifyingKey || !securityKeyInput.trim()}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold px-4 py-2 text-xs transition cursor-pointer disabled:opacity-40 shadow-sm"
                    >
                      {verifyingKey ? 'Validando...' : 'Completar Envío con esta Llave'}
                    </button>
                  </div>
                  {keyError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-semibold">{keyError}</p>}
                </div>
              )
            )}

            {/* Acciones de entrega (El gerente NO ve mapa GPS; solo domiciliario o proveedor) */}
            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-sky-100 dark:border-slate-700">
              {!isGerente && (isDriver || isSupplier || user?.role === 'admin') && (
                <Link
                  to="/logistica"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Ver en Mapa GPS en Tiempo Real</span>
                </Link>
              )}

              {canManageDelivery && (
                <button
                  onClick={() => {
                    setDeliveryForm({
                      driver_id: latestDelivery.driver_id ? String(latestDelivery.driver_id) : '',
                      vehicle_id: latestDelivery.vehicle_id ? String(latestDelivery.vehicle_id) : '',
                      scheduled_time: latestDelivery.scheduled_time || '',
                    });
                    setDeliveryModal(true);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 inline-flex items-center gap-1.5"
                >
                  <IconEdit className="w-3.5 h-3.5" />
                  <span>Cambiar Domiciliario / Vehículo</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors duration-200">
          <h3 className="mb-2 font-bold text-slate-800 dark:text-white text-sm">Historial de Eventos</h3>
          {history.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">Sin eventos registrados.</p>}
          <ul className="space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1.5 text-slate-700 dark:text-slate-300">
                <span>{h.action === 'create' ? 'Pedido creado' : `Cambio de estado: ${h.action}`}</span>
                <span className="text-gray-400 dark:text-slate-500 text-xs">{formatDate(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="h-fit rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 transition-colors duration-200">
        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Gestión del Pedido</h3>

        {/* Botón directo para asignar domiciliario si aún no tiene */}
        {canManageDelivery && (!latestDelivery || !latestDelivery.driver_id) && !done && (
          <button
            onClick={() => setDeliveryModal(true)}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Asignar Domiciliario al Pedido</span>
          </button>
        )}

        {isSupplier ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flujo de Estados:</p>
            {SUPPLIER_FLOW.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={done || order.status === s || SUPPLIER_FLOW.indexOf(s) < SUPPLIER_FLOW.indexOf(order.status)}
                className="w-full rounded-xl border border-brand py-2 text-sm font-bold text-brand hover:bg-brand hover:text-white disabled:opacity-40 transition"
              >
                Marcar como {ORDER_STATUS[s].label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => changeStatus('cancelado')}
            disabled={done}
            className="w-full rounded-xl border border-red-500 py-2 text-sm font-medium text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-40 transition"
          >
            Cancelar pedido
          </button>
        )}
        <p className="text-xs text-gray-400">Los cambios se sincronizan en tiempo real.</p>
      </div>

      {deliveryModal && (
        <Modal title="Asignar Domiciliario y Programar Entrega" onClose={() => setDeliveryModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Seleccionar Domiciliario / Conductor:</label>
              <select
                value={deliveryForm.driver_id}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, driver_id: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
                required
              >
                <option value="">-- Elige un usuario del sistema --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'} {d.phone ? `· Tel: ${d.phone}` : ''}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No se encontraron usuarios registrados.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Vehículo de Entrega (opcional):</label>
              <select
                value={deliveryForm.vehicle_id}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicle_id: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Sin vehículo específico asignado --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plate}) · {v.type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Fecha y hora estimada (opcional):</label>
              <input
                type="datetime-local"
                value={deliveryForm.scheduled_time}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, scheduled_time: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={createDelivery}
              disabled={!deliveryForm.driver_id}
              className="w-full rounded-xl bg-brand py-2.5 text-white font-bold hover:bg-brand-dark disabled:opacity-50 shadow transition"
            >
              Asignar Domiciliario y Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
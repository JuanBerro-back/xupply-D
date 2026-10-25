import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getExactLocation, watchExactLocation, requestLocationPermissions } from '../lib/location';
import { useAuth } from '../context/AuthContext';
import { Delivery, DeliveryDetails, Vehicle } from '../types';
import { DELIVERY_STATUS, formatDate } from '../lib/constants';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';
import { getSocket } from '../lib/socket';
import DeliveryMap from '../components/DeliveryMap';
import { coordOf, distanceKm, formatDistance } from '../lib/geo';
import { IconPin, IconKey } from '../components/Icons';
import { ArrowUpDown, RefreshCw, Search, X } from 'lucide-react';

type PositionEvent = {
  delivery_id: number;
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  eta_min?: number | null;
  status?: string;
  driver_name?: string;
};
// Las posiciones se toman SOLO de datos reales del backend. Si una entrega
// no tiene coordenadas, la vista lo indica en lugar de inventar un punto.
function driverPositionFor(
  delivery: Delivery,
  myCoords?: { lat: number; lng: number } | null
): { lat: number; lng: number } | null {
  return coordOf(delivery.vehicle_lat, delivery.vehicle_lng) ?? myCoords ?? null;
}

function destinationPositionFor(delivery: Delivery): { lat: number; lng: number } | null {
  return coordOf(delivery.dest_lat, delivery.dest_lng);
}

function calculateDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  return distanceKm(a, b);
}

function getVehicleIcon(type?: string) {
  const t = (type || '').toLowerCase();
  if (t === 'camion') {
    return (
      <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM3 5h11v10H3V5zm11 3h4l3 4v3h-7V8z" />
      </svg>
    );
  }
  if (t === 'furgon') {
    return (
      <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2zm1 0a2 2 0 104 0m6 0a2 2 0 104 0" />
      </svg>
    );
  }
  if (t === 'camioneta') {
    return (
      <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM4 9l2-4h10l2 4M3 13h18v4H3v-4z" />
      </svg>
    );
  }
  // Default moto
  return (
    <svg className="w-5 h-5 text-sky-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zm-7-6l3-4h3m-6 4l-3 4H5m7-4v4" />
    </svg>
  );
}

function getVehicleLabel(type?: string) {
  const t = (type || '').toLowerCase();
  if (t === 'camion') return 'Camión';
  if (t === 'furgon') return 'Furgón';
  if (t === 'camioneta') return 'Camioneta';
  return 'Moto';
}

export default function Deliveries({ focusMode = false }: { focusMode?: boolean } = {}) {
  const { user } = useAuth();
  const { push } = useNotifications();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [modalVehicle, setModalVehicle] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [vehicleForm, setVehicleForm] = useState({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });

  // Estado de carga y detalle del pedido para el HUD del mapa
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [details, setDetails] = useState<Record<number, DeliveryDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [sortBy, setSortBy] = useState<'cercanas' | 'recientes'>('cercanas');

  // Modal para reasignar usuario a un vehículo
  const [assignVehicleModal, setAssignVehicleModal] = useState<Vehicle | null>(null);
  const [assignVehicleDriverId, setAssignVehicleDriverId] = useState('');

  // Telemetría GPS en tiempo real
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [myHeading, setMyHeading] = useState<number | null>(null);
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'activo' | 'inactivo' | 'pendiente' | 'error'>('inactivo');
  const [gpsManualEnabled, setGpsManualEnabled] = useState(true);
  // ETA calculado por el servidor (geocerca/velocidad real) por entrega
  const [serverEta, setServerEta] = useState<Record<number, number | null>>({});
  // Throttle local de pings GPS al servidor (mín. 5 s, el backend también valida)
  const lastPingRef = useRef(0);

  // Modal para confirmar entrega con código
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');

  // Modal para asignar domiciliario (rol proveedor)
  const [assignModal, setAssignModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [assignmentLoadError, setAssignmentLoadError] = useState('');

  const isSupplier = user?.role === 'proveedor_admin';
  const isDriver = user?.role === 'domiciliario';
  const canManage = isSupplier || user?.role === 'admin' || user?.role === 'gerente';

  const notify = useCallback(
    (message: string) => push({ message, at: new Date().toISOString() }),
    [push]
  );

  const load = useCallback(() => {
    setLoadError('');
    api<Delivery[]>('/deliveries')
      .then((next) => {
        const normalized = Array.isArray(next)
          ? next.filter((d): d is Delivery => Boolean(d && typeof d?.id === 'number'))
          : [];
        setDeliveries(normalized);
        setSelected((prev) => {
          // Conserva la selección si sigue existiendo; si no, la próxima
          // entrega activa (nunca datos de demostración).
          const fresh = prev ? normalized.find((d) => d.id === prev.id) : undefined;
          if (fresh) return fresh;
          return (
            normalized.find((d) => d.status !== 'entregado' && d.status !== 'fallido') ??
            normalized[0] ??
            null
          );
        });
      })
      .catch((err) => {
        console.error(err);
        setLoadError((err as Error)?.message || 'No se pudieron cargar las entregas.');
      })
      .finally(() => setLoading(false));

    if (canManage) {
      setAssignmentLoadError('');
      api<Vehicle[]>('/deliveries/vehicles')
        .then(setVehicles)
        .catch((err) => {
          console.error('No se pudo cargar la flota de vehículos:', err);
          setAssignmentLoadError((current) => current || 'No se pudo cargar la flota de vehículos. Intenta actualizar la página.');
        });
      api<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>('/deliveries/drivers')
        .then(setDrivers)
        .catch((err) => {
          console.error('No se pudieron cargar los domiciliarios:', err);
          setAssignmentLoadError((current) => current || 'No se pudieron cargar los domiciliarios. Intenta actualizar la página.');
        });
      api<any[]>('/orders').then((allOrders) => {
        if (Array.isArray(allOrders)) {
          setPendingOrders(allOrders.filter((o) => !['entregado', 'cancelado'].includes(o.status)));
        }
      }).catch(() => undefined);
    }
  }, [canManage]);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;

    const onPosition = (event: PositionEvent) => {
      setLiveSpeed(event.speed ?? null);
      if (typeof event.eta_min === 'number') {
        const eta = event.eta_min;
        setServerEta((prev) => ({ ...prev, [event.delivery_id]: eta }));
      }
      // Sincronizar la tarjeta de acciones si la geocerca cambió el estado (p. ej. → 'llegando')
      if (event.status) {
        setSelected((prev) =>
          prev && prev.id === event.delivery_id && prev.status !== event.status
            ? { ...prev, status: event.status as Delivery['status'] }
            : prev
        );
      }
      setDeliveries((current) =>
        current.map((delivery) =>
          delivery.id === event.delivery_id
            ? {
                ...delivery,
                vehicle_lat: event.lat,
                vehicle_lng: event.lng,
                last_location_update: new Date().toISOString(),
                ...(event.status && event.status !== delivery.status
                  ? { status: event.status as Delivery['status'] }
                  : {}),
              }
            : delivery
        )
      );
    };

    const onStatus = () => load();
    socket.on('delivery:position', onPosition);
    socket.on('delivery:status', onStatus);

    return () => {
      socket.off('delivery:position', onPosition);
      socket.off('delivery:status', onStatus);
    };
  }, [load]);

  const refreshGps = async () => {
    setGpsManualEnabled(true);
    setGpsStatus('pendiente');
    try {
      await requestLocationPermissions();
      const loc = await getExactLocation();
      if (loc) {
        setMyCoords({ lat: loc.lat, lng: loc.lng });
        setGpsAccuracy(loc.accuracy);
        setLiveSpeed(loc.speed ?? null);
        setMyHeading(loc.heading ?? null);
        setGpsStatus('activo');
        push({
          message: `GPS sincronizado (Precisión: ±${loc.accuracy}m)`,
          at: new Date().toISOString(),
        });
      } else {
        setGpsStatus('error');
        push({
          message: 'No se pudo obtener la posición GPS exacta. Activa la ubicación de tu teléfono.',
          at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[GPS] Error en refreshGps:', e);
      setGpsStatus('error');
    }
  };

  // Rastreo GPS en tiempo real de alta exactitud (Capacitor nativo FusedLocation / Navegador)
  useEffect(() => {
    if (!gpsManualEnabled) {
      setGpsStatus('inactivo');
      return;
    }

    let isMounted = true;
    setGpsStatus('pendiente');

    // 1. Obtener ubicación precisa inicial inmediata
    getExactLocation().then((loc) => {
      if (!isMounted || !loc) return;
      setMyCoords({ lat: loc.lat, lng: loc.lng });
      setGpsAccuracy(loc.accuracy);
      setLiveSpeed(loc.speed ?? null);
      setMyHeading(loc.heading ?? null);
      setGpsStatus('activo');
    });

    // 2. Transmisión continua en tiempo real con alta exactitud
    const unwatch = watchExactLocation(
      (loc) => {
        if (!isMounted) return;
        setMyCoords({ lat: loc.lat, lng: loc.lng });
        setGpsAccuracy(loc.accuracy);
        setLiveSpeed(loc.speed ?? null);
        setMyHeading(loc.heading ?? null);
        setGpsStatus('activo');

        // Si el usuario es domiciliario y tiene entrega activa, reporta telemetría al servidor
        if (isDriver) {
          const myActiveDelivery = deliveries.find(
            (d) => d.status !== 'entregado' && d.status !== 'fallido' && (d.driver_id === user?.id || !d.driver_id)
          );

          if (myActiveDelivery) {
            // Throttle local: máximo un ping cada 5 s (igual que el backend)
            const now = Date.now();
            if (now - lastPingRef.current >= 5000) {
              lastPingRef.current = now;
              api(`/deliveries/${myActiveDelivery.id}/position`, {
                method: 'PATCH',
                body: JSON.stringify({
                  lat: loc.lat,
                  lng: loc.lng,
                  speed: loc.speed,
                  heading: loc.heading ?? null,
                  accuracy: loc.accuracy,
                }),
              }).catch(() => undefined);
            }
          }
        }
      },
      (err) => {
        console.warn('[GPS] Error de seguimiento:', err);
        if (isMounted) setGpsStatus('error');
      }
    );

    return () => {
      isMounted = false;
      unwatch();
    };
  }, [isDriver, gpsManualEnabled, deliveries, user?.id]);

  // Unirse a la sala de seguimiento de la entrega seleccionada
  // (el backend emite delivery:position/status/eta solo a las partes autorizadas)
  const selectedId = selected?.id;
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !selectedId) return;
    socket.emit('delivery:join', selectedId);
    return () => {
      socket.emit('delivery:leave', selectedId);
    };
  }, [selectedId]);

  // Detalle del pedido (productos, total y notas) para el HUD del mapa.
  useEffect(() => {
    const id = selected?.id;
    if (!id || details[id]) return;
    let cancelled = false;
    setDetailsLoading(true);
    api<DeliveryDetails & Delivery>(`/deliveries/${id}`)
      .then((data) => {
        if (!cancelled) setDetails((prev) => ({ ...prev, [id]: data }));
      })
      .catch((err) => console.warn('No se pudo cargar el detalle del pedido:', err))
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, details]);

  const changeStatus = async (id: number, status: string) => {
    try {
      await api(`/deliveries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      notify(`Estado de la entrega actualizado → ${status.replace('_', ' ')}`);
      load();
    } catch (err) {
      notify((err as Error).message);
    }
  };

  const confirmDelivery = async () => {
    if (!selected) return;
    try {
      await api(`/deliveries/${selected.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirmation_code: confirmCode }),
      });
      notify('Entrega confirmada y completada.');
      setConfirmModal(false);
      setConfirmCode('');
      load();
    } catch (err) {
      notify((err as Error).message);
    }
  };

  const assignDriver = async () => {
    if (!selected || !selectedDriverId || !selectedVehicleId) return;
    try {
      await api(`/deliveries/${selected.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({
          driver_id: Number(selectedDriverId),
          vehicle_id: Number(selectedVehicleId),
        }),
      });
      notify('Domiciliario asignado.');
      setAssignModal(false);
      load();
    } catch (err) {
      notify((err as Error).message);
    }
  };

  const createVehicle = async () => {
    try {
      let driverName = vehicleForm.driver_name;
      if (vehicleForm.driver_id) {
        const found = drivers.find((d) => d.id === Number(vehicleForm.driver_id));
        if (found) driverName = found.name;
      }
      await api('/deliveries/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          ...vehicleForm,
          driver_name: driverName || null,
          driver_id: vehicleForm.driver_id ? Number(vehicleForm.driver_id) : null,
        }),
      });
      notify('Vehículo registrado en la flota.');
      setModalVehicle(false);
      setVehicleForm({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });
      load();
    } catch (err) {
      notify((err as Error).message);
    }
  };

  const assignDriverToVehicle = async () => {
    if (!assignVehicleModal) return;
    try {
      let driverName = '';
      if (assignVehicleDriverId) {
        const found = drivers.find((d) => d.id === Number(assignVehicleDriverId));
        if (found) driverName = found.name;
      }
      await api(`/deliveries/vehicles/${assignVehicleModal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          driver_id: assignVehicleDriverId ? Number(assignVehicleDriverId) : null,
          driver_name: driverName || null,
        }),
      });
      notify('Vehículo asignado al usuario.');
      setAssignVehicleModal(null);
      load();
    } catch (err) {
      notify((err as Error).message);
    }
  };

  const activeDeliveries = useMemo(
    () => deliveries.filter((d) => d.status !== 'entregado' && d.status !== 'fallido'),
    [deliveries]
  );

  // Búsqueda + orden por cercanía: la "siguiente parada" queda primero.
  const visibleDeliveries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = deliveries.filter((d) => {
      if (onlyActive && (d.status === 'entregado' || d.status === 'fallido')) return false;
      if (!q) return true;
      return [d.order_code, d.delivery_code, d.restaurant_name, d.delivery_address, d.driver_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    if (sortBy === 'recientes') return list;
    const legDistance = (d: Delivery) => {
      const from = driverPositionFor(d, isDriver ? myCoords : null);
      const to = destinationPositionFor(d);
      return from && to ? distanceKm(from, to) : Number.POSITIVE_INFINITY;
    };
    return [...list].sort((a, b) => legDistance(a) - legDistance(b));
  }, [deliveries, query, onlyActive, sortBy, myCoords, isDriver]);

  const isGerente = user?.role === 'gerente' || (!!user?.restaurant_id && user?.role !== 'admin');
  if (isGerente) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-5">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
          <IconPin className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Visualización de Mapa GPS Restringida</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Por políticas de privacidad y seguridad logística, los gerentes de restaurantes no visualizan el mapa GPS satelital de la flota de despacho.
        </p>
        <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-700 text-left space-y-2 border border-slate-200">
          <p className="font-bold text-slate-800 text-sm">¿Cómo verificar el estado de tu pedido?</p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-600">
            <li>Ingresa a la sección <b>Pedidos</b> y haz clic sobre tu orden activa.</li>
            <li>En la información del pedido podrás ver el <b>estado del despacho, la ubicación de entrega y quién lo lleva</b> (nombre del domiciliario, teléfono y vehículo).</li>
            <li>Al recibir tu pedido en el restaurante, el domiciliario te entregará la <b>Llave de Seguridad</b> para confirmar la entrega con el código.</li>
          </ul>
        </div>
        <Link
          to="/pedidos"
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-bold text-white hover:bg-brand-dark transition shadow-md active:scale-95"
        >
          <span>Ir a Mis Pedidos</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>
    );
  }

  // Acciones del pedido seleccionado: se muestran dentro de la hoja del mapa
  // (pantalla completa incluida) para no obligar a bajar por la página.
  const orderActions = selected ? (
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
                onClick={() => changeStatus(selected.id, 'en_camino')}
                className="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-blue-700 active:scale-95"
              >
                Iniciar viaje
              </button>
            )}
            {selected.status === 'en_camino' && (
              <button
                type="button"
                onClick={() => changeStatus(selected.id, 'llegando')}
                className="rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-white shadow transition hover:bg-amber-600 active:scale-95"
              >
                Estoy llegando al destino
              </button>
            )}
            {selected.status !== 'entregado' && (
              <button
                type="button"
                onClick={() => setConfirmModal(true)}
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
          onClick={() => {
            setSelectedDriverId(selected.driver_id ? String(selected.driver_id) : '');
            setAssignModal(true);
          }}
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-indigo-700 active:scale-95"
        >
          Asignar / cambiar domiciliario
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ruta GPS y Entregas</h2>
          <p className="text-sm text-slate-500">
            {isDriver
              ? 'Monitoreo en vivo tipo DiDi con línea de proximidad hacia tu entrega'
              : 'Seguimiento y telemetría de entregas en tiempo real'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de estado GPS y calibración de alta exactitud */}
          <button
            type="button"
            onClick={refreshGps}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition active:scale-95 ${
              gpsStatus === 'activo'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : gpsStatus === 'pendiente'
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
            title="Haga clic para sincronizar o recalibrar la posición GPS con alta exactitud"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                gpsStatus === 'activo'
                  ? 'bg-emerald-500 animate-pulse'
                  : gpsStatus === 'pendiente'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            {gpsStatus === 'activo'
              ? `GPS Activo ${gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}`
              : gpsStatus === 'pendiente'
              ? 'Conectando GPS...'
              : 'Reconectar GPS'}
          </button>

          {canManage && (
            <button
              onClick={() => {
                setVehicleForm({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });
                setModalVehicle(true);
              }}
              className="rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-dark active:scale-95 transition flex items-center gap-1.5"
            >
              <span>+</span> Vehículo
            </button>
          )}
        </div>
      </div>

      {/* Mapa en vivo estilo DiDi: pantalla completa, HUD de destino y hoja de resumen */}
      <div
        className={
          focusMode
            ? 'space-y-2'
            : 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]'
        }
      >
        <DeliveryMap
          deliveries={deliveries}
          selected={selected}
          onSelect={setSelected}
          myCoords={myCoords}
          heading={myHeading}
          isDriver={isDriver}
          liveSpeed={liveSpeed}
          gpsAccuracy={gpsAccuracy}
          liveEta={selected ? serverEta[selected.id] : null}
          details={selected ? details[selected.id] ?? null : null}
          detailsLoading={detailsLoading}
          isLoading={loading}
          loadError={loadError}
          initialFullscreen={focusMode}
          actions={orderActions}
          onOpenOrder={(delivery) => navigate(`/pedidos/${delivery.order_id}`)}
        />

        {/* Lista lateral de entregas (se oculta en el modo repartidor) */}
        {!focusMode && (
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Entregas</h3>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {activeDeliveries.length} activa(s)
              </span>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar pedido, dirección..."
                  aria-label="Buscar entregas"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs font-medium outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSortBy((v) => (v === 'cercanas' ? 'recientes' : 'cercanas'))}
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
                onClick={() => setOnlyActive(true)}
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
                onClick={() => setOnlyActive(false)}
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
                onClick={load}
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
              {loading && deliveries.length === 0 && (
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
                const isCurrent = selected?.id === delivery.id;
                const st = DELIVERY_STATUS[delivery.status] ?? DELIVERY_STATUS.asignado;
                const from = driverPositionFor(delivery, isDriver ? myCoords : null);
                const to = destinationPositionFor(delivery);
                const legDistance = from && to ? calculateDistanceKm(from, to) : null;

                return (
                  <button
                    key={delivery.id}
                    type="button"
                    onClick={() => setSelected(delivery)}
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
        )}
      </div>

      {/* Flota de Vehículos Registrados (Motos, Camiones, Furgones) */}
      {canManage && (
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
              onClick={() => {
                setVehicleForm({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });
                setModalVehicle(true);
              }}
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
                const icon = getVehicleIcon(v.type);
                const typeLabel = getVehicleLabel(v.type);
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
                        onClick={() => {
                          setAssignVehicleModal(v);
                          setAssignVehicleDriverId(v.driver_id ? String(v.driver_id) : '');
                        }}
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
      )}

      {/* Historial completo de entregas */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-bold text-slate-800 text-sm">Historial General de Entregas</h3>
        <div className="divide-y divide-slate-100">
          {deliveries.map((d) => {
            const st = DELIVERY_STATUS[d.status] ?? { label: d.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div
                key={d.id}
                onClick={() => setSelected(d)}
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
                  {d.confirmation_code && (isSupplier || user?.role === 'gerente') && (
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

      {/* Modal para confirmar entrega con código (Domiciliario) */}
      {confirmModal && selected && (
        <Modal title={`Confirmar Entrega ${selected.order_code}`} onClose={() => setConfirmModal(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Solicita al cliente/restaurante el <b>código de confirmación de 4 dígitos</b> generado para este pedido:
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Código de confirmación:</label>
              <input
                type="text"
                maxLength={4}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="Ej: 4821"
                className="w-full rounded-xl border px-3 py-2 text-center text-xl font-mono tracking-widest font-bold"
                required
              />
            </div>
            <button
              onClick={confirmDelivery}
              disabled={confirmCode.length < 4}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Validar y Finalizar Entrega
            </button>
          </div>
        </Modal>
      )}

      {/* Modal para asignar repartidor (Proveedor / Gerente / Admin) */}
      {assignModal && selected && (
        <Modal title={`Asignar Domiciliario a ${selected.order_code}`} onClose={() => setAssignModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Seleccionar domiciliario:</label>
              <select
                value={selectedDriverId}
                onChange={(e) => {
                  const driverId = e.target.value;
                  setSelectedDriverId(driverId);
                  const assignedVehicle = vehicles.find((vehicle) => vehicle.driver_id === Number(driverId));
                  setSelectedVehicleId(assignedVehicle ? String(assignedVehicle.id) : '');
                }}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
              >
                <option value="">-- Elige un domiciliario --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) {d.phone ? `· Tel: ${d.phone}` : ''}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No hay domiciliarios activos registrados para este proveedor.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Vehículo para la entrega:</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                disabled={!selectedDriverId}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">-- Elige un vehículo --</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} · {vehicle.plate} ({vehicle.type})
                    {vehicle.driver_name ? ` · Conductor: ${vehicle.driver_name}` : ' · Sin conductor asignado'}
                  </option>
                ))}
              </select>
              {assignmentLoadError ? (
                <p className="mt-1 text-xs text-red-600">{assignmentLoadError}</p>
              ) : vehicles.length === 0 ? (
                <p className="mt-1 text-xs text-amber-600">No hay vehículos activos en la flota. Registra un vehículo antes de asignar la entrega.</p>
              ) : null}
            </div>
            <button
              onClick={assignDriver}
              disabled={!selectedDriverId || !selectedVehicleId || Boolean(assignmentLoadError)}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50 shadow transition"
            >
              Asignar y Notificar al Domiciliario
            </button>
          </div>
        </Modal>
      )}

      {/* Modal para nuevo vehículo */}
      {modalVehicle && (
        <Modal title="Registrar Nuevo Vehículo (Camión / Moto)" onClose={() => setModalVehicle(false)}>
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Tipo de Vehículo *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'camion', label: 'Camión', desc: 'Carga pesada' },
                  { id: 'moto', label: 'Moto', desc: 'Repartos ágiles' },
                  { id: 'furgon', label: 'Furgón', desc: 'Seco / Frío' },
                  { id: 'camioneta', label: 'Camioneta', desc: 'Utilitario' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setVehicleForm({ ...vehicleForm, type: item.id })}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      vehicleForm.type === item.id
                        ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {getVehicleIcon(item.id)}
                      <span className="font-bold text-xs text-slate-800">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Nombre o Identificador *</label>
              <input
                value={vehicleForm.name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                placeholder="Ej: Camión Norte 1, Moto Express 2"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Placa del Vehículo *</label>
              <input
                value={vehicleForm.plate}
                onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })}
                placeholder="Ej: ABC-123"
                className="w-full rounded-xl border px-3 py-2 text-sm font-mono uppercase"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Asignar a Usuario / Conductor:</label>
              <select
                value={vehicleForm.driver_id}
                onChange={(e) => {
                  const val = e.target.value;
                  const found = drivers.find((d) => d.id === Number(val));
                  setVehicleForm({
                    ...vehicleForm,
                    driver_id: val,
                    driver_name: found ? found.name : '',
                  });
                }}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
              >
                <option value="">-- Sin conductor asignado (asignar luego) --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">IMEI del GPS (opcional):</label>
              <input
                value={vehicleForm.imei}
                onChange={(e) => setVehicleForm({ ...vehicleForm, imei: e.target.value })}
                placeholder="IMEI del GPS (15 dígitos, opcional)"
                className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
              />
            </div>

            <button
              onClick={createVehicle}
              disabled={!vehicleForm.name.trim() || !vehicleForm.plate.trim()}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark shadow transition disabled:opacity-50"
            >
              Guardar y Registrar Vehículo
            </button>
          </div>
        </Modal>
      )}

      {/* Modal para Asignar / Cambiar Conductor del Vehículo */}
      {assignVehicleModal && (
        <Modal
          title={`Asignar Usuario a: ${assignVehicleModal.name} (${assignVehicleModal.plate})`}
          onClose={() => setAssignVehicleModal(null)}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                {getVehicleIcon(assignVehicleModal.type)}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{assignVehicleModal.name}</p>
                <p className="text-xs text-slate-500">
                  {getVehicleLabel(assignVehicleModal.type)} · Placa: <b>{assignVehicleModal.plate}</b>
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Seleccionar Usuario / Domiciliario:</label>
              <select
                value={assignVehicleDriverId}
                onChange={(e) => setAssignVehicleDriverId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
              >
                <option value="">-- Sin conductor asignado --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={assignDriverToVehicle}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark shadow transition active:scale-95"
            >
              Confirmar Asignación Vehicular
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/api/client';
import { getExactLocation, watchExactLocation, requestLocationPermissions } from '../utils/location';
import { useAuth } from '../../../shared/context/AuthContext';
import { Delivery, DeliveryDetails, Vehicle } from '../../../shared/types';
import { useNotifications } from '../../../shared/context/NotificationContext';
import { getSocket } from '../../../shared/api/socket';
import { useSocketSubscription } from '../../../shared/hooks/useSocketSubscription';
import DeliveryMap from '../components/DeliveryMap';
import { calculateDistanceKm, destinationPositionFor, driverPositionFor } from '../utils/positions';
import { DriverOption, VehicleFormState } from '../types';
import MapRestrictedNotice from '../components/MapRestrictedNotice';
import DeliveryActions from '../components/DeliveryActions';
import DeliverySidePanel from '../components/DeliverySidePanel';
import FleetPanel from '../components/FleetPanel';
import DeliveryHistory from '../components/DeliveryHistory';
import ConfirmDeliveryModal from '../components/ConfirmDeliveryModal';
import AssignDriverModal from '../components/AssignDriverModal';
import NewVehicleModal from '../components/NewVehicleModal';
import AssignVehicleModal from '../components/AssignVehicleModal';

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

export default function Deliveries({ focusMode = false }: { focusMode?: boolean } = {}) {
  const { user } = useAuth();
  const { push } = useNotifications();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [modalVehicle, setModalVehicle] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });

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
      api<DriverOption[]>('/deliveries/drivers')
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
  }, [load]);

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
  useSocketSubscription({ 'delivery:position': onPosition, 'delivery:status': onStatus }, [load]);

  // Sin Socket.IO (Vercel) la posición y el estado se refrescan por polling.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 20_000);
    return () => window.clearInterval(timer);
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
      return from && to ? calculateDistanceKm(from, to) : Number.POSITIVE_INFINITY;
    };
    return [...list].sort((a, b) => legDistance(a) - legDistance(b));
  }, [deliveries, query, onlyActive, sortBy, myCoords, isDriver]);

  const isGerente = user?.role === 'gerente' || (!!user?.restaurant_id && user?.role !== 'admin');
  if (isGerente) return <MapRestrictedNotice />;

  // Acciones del pedido seleccionado: se muestran dentro de la hoja del mapa
  // (pantalla completa incluida) para no obligar a bajar por la página.
  const orderActions = selected ? (
    <DeliveryActions
      selected={selected}
      isDriver={isDriver}
      canManage={canManage}
      onStatusChange={changeStatus}
      onConfirm={() => setConfirmModal(true)}
      onAssign={() => {
        setSelectedDriverId(selected.driver_id ? String(selected.driver_id) : '');
        setAssignModal(true);
      }}
    />
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
          <DeliverySidePanel
            activeCount={activeDeliveries.length}
            query={query}
            onQueryChange={setQuery}
            sortBy={sortBy}
            onSortToggle={() => setSortBy((v) => (v === 'cercanas' ? 'recientes' : 'cercanas'))}
            onlyActive={onlyActive}
            onOnlyActiveChange={setOnlyActive}
            onRefresh={load}
            loadError={loadError}
            loading={loading}
            deliveriesCount={deliveries.length}
            visibleDeliveries={visibleDeliveries}
            selectedId={selected?.id}
            isDriver={isDriver}
            myCoords={myCoords}
            canManage={canManage}
            pendingOrders={pendingOrders}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Flota de Vehículos Registrados (Motos, Camiones, Furgones) */}
      {canManage && (
        <FleetPanel
          vehicles={vehicles}
          onNewVehicle={() => {
            setVehicleForm({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });
            setModalVehicle(true);
          }}
          onAssignVehicle={(v) => {
            setAssignVehicleModal(v);
            setAssignVehicleDriverId(v.driver_id ? String(v.driver_id) : '');
          }}
        />
      )}

      {/* Historial completo de entregas */}
      <DeliveryHistory
        deliveries={deliveries}
        canShowCodes={isSupplier || user?.role === 'gerente'}
        onSelect={setSelected}
      />

      {/* Modal para confirmar entrega con código (Domiciliario) */}
      {confirmModal && selected && (
        <ConfirmDeliveryModal
          orderCode={selected.order_code}
          code={confirmCode}
          onCodeChange={setConfirmCode}
          onConfirm={confirmDelivery}
          onClose={() => setConfirmModal(false)}
        />
      )}

      {/* Modal para asignar repartidor (Proveedor / Gerente / Admin) */}
      {assignModal && selected && (
        <AssignDriverModal
          orderCode={selected.order_code}
          drivers={drivers}
          vehicles={vehicles}
          selectedDriverId={selectedDriverId}
          selectedVehicleId={selectedVehicleId}
          assignmentLoadError={assignmentLoadError}
          onDriverChange={(driverId) => {
            setSelectedDriverId(driverId);
            const assignedVehicle = vehicles.find((vehicle) => vehicle.driver_id === Number(driverId));
            setSelectedVehicleId(assignedVehicle ? String(assignedVehicle.id) : '');
          }}
          onVehicleChange={setSelectedVehicleId}
          onAssign={assignDriver}
          onClose={() => setAssignModal(false)}
        />
      )}

      {/* Modal para nuevo vehículo */}
      {modalVehicle && (
        <NewVehicleModal
          form={vehicleForm}
          drivers={drivers}
          onChange={(patch) => setVehicleForm((prev) => ({ ...prev, ...patch }))}
          onDriverChange={(val) => {
            const found = drivers.find((d) => d.id === Number(val));
            setVehicleForm({
              ...vehicleForm,
              driver_id: val,
              driver_name: found ? found.name : '',
            });
          }}
          onCreate={createVehicle}
          onClose={() => setModalVehicle(false)}
        />
      )}

      {/* Modal para Asignar / Cambiar Conductor del Vehículo */}
      {assignVehicleModal && (
        <AssignVehicleModal
          vehicle={assignVehicleModal}
          drivers={drivers}
          driverId={assignVehicleDriverId}
          onDriverChange={setAssignVehicleDriverId}
          onConfirm={assignDriverToVehicle}
          onClose={() => setAssignVehicleModal(null)}
        />
      )}
    </div>
  );
}

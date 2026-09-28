import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getExactLocation, watchExactLocation, requestLocationPermissions } from '../lib/location';
import { useAuth } from '../context/AuthContext';
import { Delivery, Vehicle } from '../types';
import { DELIVERY_STATUS, formatDate } from '../lib/constants';
import Modal from '../components/Modal';
import { useNotifications } from '../context/NotificationContext';
import { getSocket } from '../lib/socket';
import { CircleMarker, MapContainer, Popup, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  resolveBucaramangaCoords,
  resolveDispatchHub,
  DEMO_BUCARAMANGA_DELIVERIES,
} from '../lib/bucaramangaGeo';
import { IconPin, IconKey } from '../components/Icons';

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
const DELIVERY_STORAGE_KEY = 'xupply_deliveries_route_v2';

// Fórmula de Haversine para calcular distancia en kilómetros entre dos coordenadas GPS
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatEta(km: number, speed?: number | null): string {
  const effectiveSpeed = speed && speed > 5 ? speed : 25; // 25 km/h promedio en ciudad
  const minutes = Math.max(1, Math.round((km / effectiveSpeed) * 60));
  return `~${minutes} min`;
}

function driverPositionFor(delivery: Delivery, myCoords?: { lat: number; lng: number } | null, isMyDelivery = false) {
  if (isMyDelivery && myCoords) return { lat: myCoords.lat, lng: myCoords.lng, name: 'Mi Posición Actual' };
  const lat = Number(delivery.vehicle_lat);
  const lng = Number(delivery.vehicle_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
    return { lat, lng, name: delivery.vehicle_name || 'Vehículo en ruta' };
  }
  if (myCoords) return { lat: myCoords.lat, lng: myCoords.lng, name: 'Mi Posición Actual' };
  // Hub real de despacho en Bucaramanga
  const hub = resolveDispatchHub(delivery.id || delivery.order_id || 1);
  return { lat: hub.lat, lng: hub.lng, name: `${hub.name} (${hub.sector})` };
}

function destinationPositionFor(delivery: Delivery) {
  const lat = Number(delivery.dest_lat);
  const lng = Number(delivery.dest_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
    return {
      lat,
      lng,
      name: delivery.restaurant_name,
      address: delivery.delivery_address,
      sector: '',
    };
  }
  // Resolver punto real de Bucaramanga por dirección o id
  const dest = resolveBucaramangaCoords(delivery.delivery_address, delivery.id || delivery.order_id || 1);
  return {
    lat: dest.lat,
    lng: dest.lng,
    name: dest.name,
    address: dest.address,
    sector: dest.sector,
  };
}

// Componente para encuadrar la ruta o centrar el mapa suavemente
function MapRecenter({
  center,
  bounds,
}: {
  center?: [number, number];
  bounds?: [[number, number], [number, number]];
}) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length === 2) {
      try {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
      } catch {
        if (center) map.setView(center, map.getZoom(), { animate: true });
      }
    } else if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [
    center ? center[0] : null,
    center ? center[1] : null,
    bounds ? bounds[0][0] : null,
    bounds ? bounds[0][1] : null,
    bounds ? bounds[1][0] : null,
    bounds ? bounds[1][1] : null,
    map,
  ]);
  return null;
}

// Botón flotante dentro del mapa para centrar en la ubicación actual del usuario
function RecenterControl({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  if (!target) return null;
  return (
    <div className="leaflet-top leaflet-right !mt-3 !mr-3 z-[999] pointer-events-auto">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          map.setView([target.lat, target.lng], 16, { animate: true });
        }}
        className="flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-blue-700 shadow-lg border border-blue-200 hover:bg-blue-50 active:scale-95 transition backdrop-blur-sm cursor-pointer"
        title="Centrar mapa en mi ubicación actual"
      >
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Mi Ubicación</span>
      </button>
    </div>
  );
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

function LiveMap({
  deliveries,
  selected,
  onSelect,
  myCoords,
  isDriver,
  liveSpeed,
  gpsAccuracy,
  liveEta,
}: {
  deliveries: Delivery[];
  selected: Delivery | null;
  onSelect: (delivery: Delivery) => void;
  myCoords: { lat: number; lng: number } | null;
  isDriver: boolean;
  liveSpeed: number | null;
  gpsAccuracy: number | null;
  liveEta?: number | null;
}) {
  const active = deliveries.filter((d) => d.status !== 'entregado' && d.status !== 'fallido');

  // Si hay una entrega seleccionada, calculamos la línea de proximidad DiDi
  const activeTarget = selected || (isDriver && active.length > 0 ? active[0] : null);

  const proximityData = useMemo(() => {
    if (!activeTarget) return null;
    const isMy = isDriver && (activeTarget.driver_id != null || active.length > 0);
    const driverPos = driverPositionFor(activeTarget, myCoords, isMy);
    const destPos = destinationPositionFor(activeTarget);
    const distKm = calculateDistanceKm(driverPos.lat, driverPos.lng, destPos.lat, destPos.lng);
    return {
      driverPos,
      destPos,
      distKm,
      originName: driverPos.name,
      destName: destPos.name,
      destAddress: destPos.address || activeTarget.delivery_address,
      destSector: destPos.sector,
      route: [
        [driverPos.lat, driverPos.lng] as [number, number],
        [destPos.lat, destPos.lng] as [number, number],
      ] as [[number, number], [number, number]],
    };
  }, [activeTarget, myCoords, isDriver, active.length]);

  const mapCenter: [number, number] = proximityData
    ? [proximityData.driverPos.lat, proximityData.driverPos.lng]
    : myCoords
    ? [myCoords.lat, myCoords.lng]
    : [7.1193, -73.1227];

  return (
    <div className="relative min-h-[440px] overflow-hidden rounded-2xl border border-slate-300 shadow-md">
      <MapContainer center={mapCenter} zoom={13} className="h-[440px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {proximityData ? (
          <MapRecenter bounds={proximityData.route} center={[proximityData.driverPos.lat, proximityData.driverPos.lng]} />
        ) : myCoords ? (
          <MapRecenter center={[myCoords.lat, myCoords.lng]} />
        ) : null}

        <RecenterControl target={myCoords} />

        {/* Línea de proximidad estilo DiDi / Rappi entre el domiciliario y el destino */}
        {proximityData && (
          <>
            <Polyline
              positions={proximityData.route}
              pathOptions={{ color: '#1e40af', weight: 6, opacity: 0.3 }}
            />
            <Polyline
              positions={proximityData.route}
              pathOptions={{ color: '#2563eb', weight: 4, dashArray: '8, 8', opacity: 0.95 }}
            />
          </>
        )}

        {/* Marcador de Mi Ubicación Actual (Exactitud GPS en tiempo real) */}
        {myCoords && (
          <>
            {/* Halo de precisión GPS en metros */}
            <CircleMarker
              center={[myCoords.lat, myCoords.lng]}
              radius={Math.min(Math.max((gpsAccuracy || 20) / 2, 12), 50)}
              pathOptions={{
                color: '#2563eb',
                weight: 1.5,
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                dashArray: '3, 3',
              }}
            />

            {/* Punto azul de usuario con borde blanco estilo Google Maps / DiDi */}
            <CircleMarker
              center={[myCoords.lat, myCoords.lng]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#2563eb',
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="text-xs p-1">
                  <p className="font-bold text-blue-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                    <span>Mi Posición Actual</span>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {myCoords.lat.toFixed(6)}, {myCoords.lng.toFixed(6)}
                  </p>
                  {gpsAccuracy != null && (
                    <p className="text-[11px] text-emerald-600 font-semibold">
                      Exactitud GPS: ±{gpsAccuracy}m
                    </p>
                  )}
                  {liveSpeed != null && liveSpeed > 0 && (
                    <p className="text-[11px] text-slate-700">
                      Velocidad: {liveSpeed} km/h
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Marcadores de todas las entregas activas */}
        {active.map((delivery) => {
          const isSelected = activeTarget?.id === delivery.id;
          const driverPos = driverPositionFor(delivery, myCoords, isDriver);
          const destPos = destinationPositionFor(delivery);

          return (
            <div key={delivery.id}>
              {/* Marcador del Domiciliario */}
              <CircleMarker
                center={[driverPos.lat, driverPos.lng]}
                radius={isSelected ? 13 : 9}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3,
                  fillColor: '#0284c7',
                  fillOpacity: 0.95,
                }}
                eventHandlers={{ click: () => onSelect(delivery) }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-sky-700">Repartidor en ruta</p>
                    <p className="font-semibold">{delivery.driver_name || 'Sin asignar'}</p>
                    <p>Pedido: {delivery.order_code}</p>
                    {liveSpeed != null && <p>Velocidad: {liveSpeed} km/h</p>}
                  </div>
                </Popup>
              </CircleMarker>

              {/* Marcador de Destino */}
              {isSelected && (
                <CircleMarker
                  center={[destPos.lat, destPos.lng]}
                  radius={12}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 3,
                    fillColor: '#059669',
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold text-emerald-700">Destino de Entrega</p>
                      <p className="font-semibold">{delivery.restaurant_name}</p>
                      <p className="text-slate-600">{delivery.delivery_address}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              )}
            </div>
          );
        })}
      </MapContainer>

      {/* Tarjeta flotante superior tipo DiDi / Uber Eats con línea de proximidad */}
      {activeTarget && proximityData && (
        <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md rounded-xl bg-slate-900/95 p-3.5 text-white shadow-2xl backdrop-blur-md z-[1000] border border-white/10">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-700/80">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              RECORRIDO EN VIVO EN BUCARAMANGA
            </span>
            <span className="text-[11px] text-slate-400 font-mono font-semibold">{activeTarget.order_code}</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Distancia de ruta:</p>
              <p className="text-xl font-extrabold text-blue-400 flex items-baseline gap-2">
                {formatDistance(proximityData.distKm)}
                <span className="text-xs font-normal text-emerald-300">
                  {liveEta != null ? `~${liveEta} min (servidor)` : formatEta(proximityData.distKm, liveSpeed)}
                </span>
              </p>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${proximityData.driverPos.lat},${proximityData.driverPos.lng}&destination=${proximityData.destPos.lat},${proximityData.destPos.lng}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow flex items-center gap-1.5 shrink-0 transition active:scale-95"
              title="Abrir navegación en Google Maps"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Navegar GPS</span>
            </a>
          </div>

          <div className="mt-2.5 space-y-1 text-xs border-t border-slate-800 pt-2">
            <div className="flex items-start gap-1.5 text-slate-300">
              <span className="h-2 w-2 mt-1 rounded-full bg-blue-400 shrink-0" />
              <div className="truncate">
                <span className="text-slate-400 font-medium">Origen: </span>
                <span className="font-semibold text-slate-200">
                  {proximityData.originName || activeTarget.vehicle_name || 'Despacho Bucaramanga'}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-1.5 text-slate-300">
              <span className="h-2 w-2 mt-1 rounded-full bg-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="text-slate-400 font-medium">Destino: </span>
                <span className="font-semibold text-slate-200">{activeTarget.restaurant_name}</span>
                {proximityData.destSector && (
                  <span className="text-blue-300 text-[10px] ml-1 font-semibold">({proximityData.destSector})</span>
                )}
                <span className="text-slate-400 text-[11px] block truncate">{activeTarget.delivery_address}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado inferior de pedidos activos */}
      <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs shadow-md border z-[1000] flex items-center gap-2">
        {active.length > 0 ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-slate-800">{active.length} entrega(s) en ruta</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="font-semibold text-slate-700">0 entregas asignadas · GPS en vivo</span>
          </>
        )}
      </div>
    </div>
  );
}

function loadPersistedDeliveries(): Delivery[] {
  try {
    const raw = localStorage.getItem(DELIVERY_STORAGE_KEY);
    if (!raw) return DEMO_BUCARAMANGA_DELIVERIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEMO_BUCARAMANGA_DELIVERIES;
    const valid = parsed.filter((d): d is Delivery => Boolean(d && typeof d?.id === 'number'));
    return valid.length > 0 ? valid : DEMO_BUCARAMANGA_DELIVERIES;
  } catch {
    return DEMO_BUCARAMANGA_DELIVERIES;
  }
}

export default function Deliveries() {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [deliveries, setDeliveries] = useState<Delivery[]>(loadPersistedDeliveries);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [modalVehicle, setModalVehicle] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [vehicleForm, setVehicleForm] = useState({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });

  // Modal para reasignar usuario a un vehículo
  const [assignVehicleModal, setAssignVehicleModal] = useState<Vehicle | null>(null);
  const [assignVehicleDriverId, setAssignVehicleDriverId] = useState('');

  // Telemetría GPS en tiempo real
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
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

  const isSupplier = user?.role === 'proveedor_admin';
  const isDriver = user?.role === 'domiciliario';
  const canManage = isSupplier || user?.role === 'admin' || user?.role === 'gerente';

  useEffect(() => {
    localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(deliveries));
  }, [deliveries]);

  const load = () => {
    api<Delivery[]>('/deliveries')
      .then((next) => {
        const normalized = Array.isArray(next) ? next.filter((d): d is Delivery => Boolean(d && typeof d?.id === 'number')) : [];
        if (normalized.length > 0) {
          setDeliveries(normalized);
          localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(normalized));
          if (!selected) {
            setSelected(normalized[0]);
          }
        } else {
          setDeliveries((prev) => (prev.length > 0 ? prev : DEMO_BUCARAMANGA_DELIVERIES));
          if (!selected) {
            setSelected(DEMO_BUCARAMANGA_DELIVERIES[0]);
          }
        }
      })
      .catch((err) => {
        console.error(err);
        const stored = loadPersistedDeliveries();
        if (stored.length) {
          setDeliveries(stored);
          if (!selected) setSelected(stored[0]);
        }
      });

    if (canManage) {
      api<Vehicle[]>('/deliveries/vehicles').then(setVehicles).catch(() => undefined);
      api<{ id: number; name: string; username: string; phone?: string; role_label?: string; role_name?: string }[]>('/deliveries/drivers').then(setDrivers).catch(() => undefined);
      api<any[]>('/orders').then((allOrders) => {
        if (Array.isArray(allOrders)) {
          setPendingOrders(allOrders.filter((o) => !['entregado', 'cancelado'].includes(o.status)));
        }
      }).catch(() => undefined);
    }
  };

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
  }, []);

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
      setGpsStatus('activo');
    });

    // 2. Transmisión continua en tiempo real con alta exactitud
    const unwatch = watchExactLocation(
      (loc) => {
        if (!isMounted) return;
        setMyCoords({ lat: loc.lat, lng: loc.lng });
        setGpsAccuracy(loc.accuracy);
        setLiveSpeed(loc.speed ?? null);
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

  const changeStatus = async (id: number, status: string) => {
    try {
      await api(`/deliveries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      push({ message: `Estado de entrega actualizado → ${status}`, at: new Date().toISOString() });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const confirmDelivery = async () => {
    if (!selected) return;
    try {
      await api(`/deliveries/${selected.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirmation_code: confirmCode }),
      });
      push({ message: '¡Entrega confirmada y completada exitosamente!', at: new Date().toISOString() });
      setConfirmModal(false);
      setConfirmCode('');
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const assignDriver = async () => {
    if (!selected || !selectedDriverId) return;
    try {
      await api(`/deliveries/${selected.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: Number(selectedDriverId) }),
      });
      push({ message: 'Domiciliario asignado exitosamente', at: new Date().toISOString() });
      setAssignModal(false);
      load();
    } catch (err) {
      alert((err as Error).message);
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
      push({ message: 'Vehículo registrado exitosamente en la flota', at: new Date().toISOString() });
      setModalVehicle(false);
      setVehicleForm({ name: '', plate: '', type: 'camion', driver_id: '', driver_name: '', imei: '' });
      load();
    } catch (err) {
      alert((err as Error).message);
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
      push({ message: 'Vehículo asignado exitosamente al usuario', at: new Date().toISOString() });
      setAssignVehicleModal(null);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const activeDeliveries = deliveries.filter((d) => d.status !== 'entregado' && d.status !== 'fallido');

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

      {/* Mapa en Vivo con línea de proximidad DiDi */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <LiveMap
          deliveries={deliveries}
          selected={selected}
          onSelect={setSelected}
          myCoords={myCoords}
          isDriver={isDriver}
          liveSpeed={liveSpeed}
          gpsAccuracy={gpsAccuracy}
          liveEta={selected ? serverEta[selected.id] : null}
        />

        {/* Lista lateral de entregas activas */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Entregas Asignadas</h3>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {activeDeliveries.length} activa(s)
              </span>
            </div>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {activeDeliveries.map((delivery, index) => {
                const isCurrent = selected?.id === delivery.id;
                const st = DELIVERY_STATUS[delivery.status] ?? DELIVERY_STATUS.asignado;
                const dPos = driverPositionFor(delivery, myCoords, isDriver);
                const rPos = destinationPositionFor(delivery);
                const itemDist = calculateDistanceKm(dPos.lat, dPos.lng, rPos.lat, rPos.lng);

                return (
                  <button
                    key={delivery.id}
                    onClick={() => setSelected(delivery)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isCurrent
                        ? 'border-brand bg-blue-50/80 ring-2 ring-brand/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900">
                        {index + 1}. {delivery.order_code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-800">
                          {formatDistance(itemDist)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-800 truncate">
                      {delivery.restaurant_name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {rPos.sector ? `${rPos.sector} · ` : ''}{delivery.delivery_address || 'Bucaramanga'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                      <span className="truncate max-w-[120px]">{delivery.driver_name ? delivery.driver_name : 'Sin domiciliario'}</span>
                      <div className="flex items-center gap-1">
                        {delivery.vehicle_name && <span className="text-slate-400 font-mono text-[10px]">{delivery.vehicle_name}</span>}
                        {canManage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(delivery);
                              setSelectedDriverId(delivery.driver_id ? String(delivery.driver_id) : '');
                              setAssignModal(true);
                            }}
                            className="rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            {delivery.driver_name ? 'Cambiar' : 'Asignar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {activeDeliveries.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500 space-y-3">
                  <p className="font-medium">No tienes entregas en ruta en este momento.</p>
                  {pendingOrders.length > 0 && canManage && (
                    <div className="text-left space-y-2 border-t pt-3">
                      <p className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span>Pedidos listos para asignar entrega:</span>
                      </p>
                      <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                        {pendingOrders.map((po) => (
                          <div
                            key={po.id}
                            className="p-2.5 border border-slate-200 rounded-xl bg-slate-50/90 flex items-center justify-between text-xs hover:bg-slate-100 transition shadow-sm"
                          >
                            <div className="truncate pr-2">
                              <span className="font-bold text-slate-900">{po.order_code}</span>
                              <p className="text-slate-500 text-[11px] truncate">{po.restaurant_name}</p>
                            </div>
                            <Link
                              to={`/pedidos/${po.id}`}
                              className="rounded-lg bg-brand px-2.5 py-1 text-white font-bold text-[11px] hover:bg-brand-dark shadow-sm shrink-0"
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
          </div>

          {/* Acciones directas para el domiciliario o proveedor */}
          {selected && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-700">
                Acciones para {selected.order_code}:
              </p>

              {/* Botones del Domiciliario */}
              {isDriver && (
                <div className="space-y-2">
                  {selected.confirmation_code && (
                    <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-3 text-center space-y-1">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block inline-flex items-center justify-center gap-1">
                        <IconKey className="w-3.5 h-3.5 text-amber-700 inline" />
                        Llave de Seguridad para el Gerente
                      </span>
                      <div className="text-xl font-black font-mono text-amber-950 tracking-widest bg-white py-1 px-3 rounded-lg border border-amber-200 inline-block shadow-xs">
                        {selected.confirmation_code}
                      </div>
                      <p className="text-[10px] text-amber-700">Díctale este código al gerente para que valide y complete la entrega</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {selected.status === 'asignado' && (
                      <button
                        onClick={() => changeStatus(selected.id, 'en_camino')}
                        className="col-span-2 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                      >
                        Iniciar Viaje (En Camino)
                      </button>
                    )}
                    {selected.status === 'en_camino' && (
                      <button
                        onClick={() => changeStatus(selected.id, 'llegando')}
                        className="col-span-2 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white shadow hover:bg-amber-600"
                      >
                        Estoy Llegando al Destino
                      </button>
                    )}
                    {selected.status === 'en_camino' && (
                      <p className="col-span-2 text-[10px] text-slate-400 text-center">
                        ℹ️ Al entrar en la geocerca de 500 m el sistema cambia a "Llegando" automáticamente.
                      </p>
                    )}
                    {selected.status !== 'entregado' && (
                      <button
                        onClick={() => setConfirmModal(true)}
                        className="col-span-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                      >
                        Confirmar Entrega (Código)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Botones del Proveedor o Gerente */}
              {canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedDriverId(selected.driver_id ? String(selected.driver_id) : '');
                      setAssignModal(true);
                    }}
                    className="flex-1 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 transition"
                  >
                    Asignar / Cambiar Repartidor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
              <label className="mb-1 block text-sm font-bold text-slate-700">Seleccionar Domiciliario / Conductor:</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white font-medium"
              >
                <option value="">-- Elige un usuario del sistema --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.username}) · {d.role_label || d.role_name || 'Usuario'} {d.phone ? `· Tel: ${d.phone}` : ''}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No se encontraron usuarios registrados en el sistema.</p>
              )}
            </div>
            <button
              onClick={assignDriver}
              disabled={!selectedDriverId}
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
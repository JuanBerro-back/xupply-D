import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { divIcon } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Crosshair,
  Expand,
  Minimize2,
  Navigation,
  Loader2,
  Phone,
  Package,
  Store,
  User,
  Route as RouteIcon,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Delivery, DeliveryDetails } from '../types';
import { DELIVERY_STATUS } from '../lib/constants';
import {
  LatLng,
  coordOf,
  distanceKm,
  fetchRoute,
  formatDistance,
  navigationUrl,
  wazeUrl,
} from '../lib/geo';

type Props = {
  deliveries: Delivery[];
  selected: Delivery | null;
  onSelect: (delivery: Delivery) => void;
  myCoords: LatLng | null;
  heading?: number | null;
  isDriver: boolean;
  liveSpeed: number | null;
  gpsAccuracy: number | null;
  liveEta?: number | null;
  details?: DeliveryDetails | null;
  detailsLoading?: boolean;
  isLoading?: boolean;
  loadError?: string | null;
  /** Arranca el mapa a pantalla completa (modo repartidor). */
  initialFullscreen?: boolean;
  /** Acciones del pedido (cambiar estado, confirmar, asignar...). */
  actions?: ReactNode;
  onOpenOrder?: (delivery: Delivery) => void;
};

const BUCARAMANGA: LatLng = { lat: 7.1193, lng: -73.1227 };

function parseMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function driverPosition(delivery: Delivery, myCoords: LatLng | null, isMine: boolean): LatLng | null {
  if (isMine && myCoords) return myCoords;
  return coordOf(delivery.vehicle_lat, delivery.vehicle_lng) ?? (isMine ? myCoords : null);
}

function destinationPosition(delivery: Delivery): LatLng | null {
  return coordOf(delivery.dest_lat, delivery.dest_lng);
}

/* ------------------------------------------------------------------ */
/* Efectos del mapa (tamaño, encuadre y seguimiento)                   */
/* ------------------------------------------------------------------ */

function MapSync({
  fullscreen,
  bounds,
  center,
  zoom,
  sheetOpen,
  centerTick,
}: {
  fullscreen: boolean;
  bounds: [[number, number], [number, number]] | null;
  center: LatLng | null;
  zoom?: number;
  sheetOpen: boolean;
  centerTick: number;
}) {
  const map = useMap();
  const lastKey = useRef('');

  // Cualquier cambio de tamaño (fullscreen, rotación, teclado, panel) debe
  // recalcular el tamaño del canvas o Leaflet deja zonas grises.
  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 180);
    return () => clearTimeout(t);
  }, [fullscreen, sheetOpen, map]);

  useEffect(() => {
    const key = bounds
      ? `b:${bounds.flat().map((n) => n.toFixed(5)).join(',')}:${sheetOpen}:${fullscreen}`
      : center
      ? `c:${center.lat.toFixed(5)},${center.lng.toFixed(5)}:${zoom ?? ''}:${centerTick}`
      : '';
    if (!key || key === lastKey.current) return;
    lastKey.current = key;

    if (bounds) {
      // Deja aire arriba (tarjetas) y abajo (hoja de resumen) para que el
      // recorrido no quede escondido detrás del HUD.
      map.fitBounds(bounds, {
        paddingTopLeft: [24, fullscreen ? 210 : 170],
        paddingBottomRight: [24, sheetOpen ? 300 : 190],
        maxZoom: 16,
        animate: true,
        duration: 0.6,
      });
    } else if (center) {
      map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
    }
  }, [bounds, center, zoom, sheetOpen, fullscreen, centerTick, map]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Marcadores                                                          */
/* ------------------------------------------------------------------ */

function vehicleIcon(heading: number | null, active: boolean) {
  const rotation = Number.isFinite(heading as number) ? Number(heading) : 0;
  return divIcon({
    className: 'xupply-map-icon',
    html: `
      <div class="xupply-vehicle ${active ? 'is-active' : ''}">
        <span class="xupply-vehicle__pulse"></span>
        <span class="xupply-vehicle__dot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${rotation}deg)">
            <path d="M12 3l7 18-7-4-7 4 7-18z" fill="currentColor" stroke="none"></path>
          </svg>
        </span>
      </div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

function destinationIcon() {
  return divIcon({
    className: 'xupply-map-icon',
    html: `
      <div class="xupply-destination">
        <span class="xupply-destination__ring"></span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 42],
  });
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export default function DeliveryMap({
  deliveries,
  selected,
  onSelect,
  myCoords,
  heading,
  isDriver,
  liveSpeed,
  gpsAccuracy,
  liveEta,
  details,
  detailsLoading,
  isLoading = false,
  loadError = null,
  initialFullscreen = false,
  actions,
  onOpenOrder,
}: Props) {
  const [fullscreen, setFullscreen] = useState(initialFullscreen);
  const [sheetOpen, setSheetOpen] = useState(initialFullscreen);
  const [route, setRoute] = useState<{ points: [number, number][]; distanceKm: number; durationMin: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [centerTick, setCenterTick] = useState(0);

  const active = useMemo(
    () => deliveries.filter((d) => d.status !== 'entregado' && d.status !== 'fallido'),
    [deliveries]
  );

  const target = selected ?? (isDriver ? active[0] ?? null : null);

  const origin = target ? driverPosition(target, myCoords, isDriver) : myCoords;
  const destination = target ? destinationPosition(target) : null;

  const straightDistance = origin && destination ? distanceKm(origin, destination) : null;

  // Ruta real (OSRM) con cancelación para no dejar peticiones colgadas.
  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    fetchRoute(origin, destination)
      .then((result) => {
        if (!cancelled) setRoute(result);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Bloqueo de scroll + Escape para salir de pantalla completa.
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  // Mantiene el sheet abierto al pasar a pantalla completa.
  useEffect(() => {
    if (initialFullscreen) return;
    setSheetOpen(fullscreen);
  }, [fullscreen, initialFullscreen]);

  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (route?.points.length) {
      const lats = route.points.map((p) => p[0]);
      const lngs = route.points.map((p) => p[1]);
      return [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
    }
    if (origin && destination) {
      return [
        [Math.min(origin.lat, destination.lat), Math.min(origin.lng, destination.lng)],
        [Math.max(origin.lat, destination.lat), Math.max(origin.lng, destination.lng)],
      ];
    }
    return null;
  }, [route, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  const mapCenter = origin ?? destination ?? myCoords ?? BUCARAMANGA;

  const distance = route?.distanceKm ?? straightDistance;
  const approxMinutes =
    distance != null
      ? Math.max(1, Math.round((distance / (liveSpeed && liveSpeed > 5 ? liveSpeed : 25)) * 60))
      : null;
  const eta = liveEta ?? route?.durationMin ?? approxMinutes;

  const status = target ? DELIVERY_STATUS[target.status] ?? DELIVERY_STATUS.asignado : null;
  const items = details?.order_items ?? [];
  const total = details?.order_total ?? target?.order_total;
  const ownerName = details?.restaurant_name ?? target?.restaurant_name ?? '—';
  const ownerPhone = details?.restaurant_phone ?? target?.restaurant_phone ?? null;
  const requester = details?.created_by_name ?? target?.created_by_name ?? null;
  const supplier = details?.supplier_name ?? target?.supplier_name ?? null;
  const notes = details?.notes ?? target?.order_notes ?? target?.notes ?? null;
  const unitCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const copyAddress = useCallback(async () => {
    const address = target?.delivery_address;
    if (!address || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin permiso de portapapeles */
    }
  }, [target?.delivery_address]);

  return (
    <section
      aria-label="Mapa de seguimiento de la entrega"
      className={
        fullscreen
          ? 'fixed inset-0 z-[1300] bg-slate-200 dark:bg-slate-950'
          : 'relative h-[clamp(380px,62vh,560px)] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800'
      }
    >
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={target?.status === 'en_camino' ? 16 : 13}
        zoomControl={false}
        className="h-full w-full bg-slate-200 dark:bg-slate-900"
      >
        <TileLayer
          className="xupply-tiles"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapSync
          fullscreen={fullscreen}
          bounds={bounds}
          center={bounds ? null : mapCenter}
          zoom={bounds ? undefined : 16}
          sheetOpen={sheetOpen}
          centerTick={centerTick}
        />

        {/* Ruta real o línea aproximada */}
        {route ? (
          <>
            <Polyline positions={route.points} pathOptions={{ color: '#0f172a', weight: 9, opacity: 0.18 }} />
            <Polyline positions={route.points} pathOptions={{ color: '#0284c7', weight: 5, opacity: 0.95 }} />
          </>
        ) : (
          origin &&
          destination && (
            <Polyline
              positions={[
                [origin.lat, origin.lng],
                [destination.lat, destination.lng],
              ]}
              pathOptions={{ color: '#0284c7', weight: 4, opacity: 0.7, dashArray: '10, 8' }}
            />
          )
        )}

        {/* Mi posición con halo de precisión */}
        {myCoords && (
          <>
            <CircleMarker
              center={[myCoords.lat, myCoords.lng]}
              radius={Math.min(Math.max((gpsAccuracy || 20) / 2, 12), 50)}
              pathOptions={{
                color: '#0284c7',
                weight: 1.5,
                fillColor: '#38bdf8',
                fillOpacity: 0.16,
                dashArray: '3, 3',
              }}
            />
            <CircleMarker
              center={[myCoords.lat, myCoords.lng]}
              radius={6}
              pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: '#0ea5e9', fillOpacity: 1 }}
            />
          </>
        )}

        {/* Vehículos de las entregas activas */}
        {active.map((delivery) => {
          const pos = driverPosition(delivery, myCoords, isDriver);
          if (!pos) return null;
          const isSelected = target?.id === delivery.id;
          return (
            <Marker
              key={`veh-${delivery.id}`}
              position={[pos.lat, pos.lng]}
              icon={vehicleIcon(isSelected ? heading ?? null : null, isSelected)}
              eventHandlers={{ click: () => onSelect(delivery) }}
              zIndexOffset={isSelected ? 800 : 0}
            >
              <Popup>
                <div className="space-y-0.5 text-xs">
                  <p className="font-bold text-sky-700">{delivery.driver_name || 'Sin domiciliario'}</p>
                  <p className="text-slate-600">
                    {delivery.vehicle_name || 'Vehículo'} {delivery.plate ? `· ${delivery.plate}` : ''}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">{delivery.order_code}</p>
                  <p className="font-semibold text-emerald-700">{DELIVERY_STATUS[delivery.status]?.label}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Destino del pedido seleccionado */}
        {destination && target && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon()} zIndexOffset={900}>
            <Popup>
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-emerald-700">Punto de entrega</p>
                <p className="font-semibold text-slate-800">{target.delivery_address}</p>
                <p className="text-slate-600">{ownerName}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* ----------------------------- HUD superior ----------------------------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] space-y-2 p-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:p-3">
        {/* Barra de estado */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-900/95 px-3 py-2 text-white shadow-lg backdrop-blur">
            <span className={`h-2 w-2 shrink-0 rounded-full ${isDriver ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
            <span className="truncate text-xs font-bold">{target?.order_code ?? 'Sin entrega seleccionada'}</span>
            {status && (
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                {status.label}
              </span>
            )}
            {gpsAccuracy != null && (
              <span className="ml-auto hidden shrink-0 text-[10px] font-semibold text-emerald-300 sm:inline">
                GPS ±{gpsAccuracy} m
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'}
            title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900/95 text-white shadow-lg backdrop-blur transition hover:bg-slate-800 active:scale-95"
          >
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
          </button>
        </div>

        {/* Destino: "para dónde es" */}
        {target && (
          <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/95 dark:ring-white/10">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Navigation className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Para dónde es
                </p>
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {target.delivery_address || 'Dirección sin registrar'}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <RouteIcon className="h-3 w-3" />
                    {distance != null ? formatDistance(distance) : 'Sin ruta'}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="text-sky-700 dark:text-sky-400">
                    {eta != null ? `~${eta} min` : routeLoading ? 'Calculando…' : '—'}
                  </span>
                  {!destination && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> Sin coordenadas
                    </span>
                  )}
                </div>

                {/* Propietario y valor del pedido, visibles sin abrir la hoja */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-1.5 text-[11px] dark:border-slate-800">
                  <span className="inline-flex min-w-0 items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                    <Store className="h-3 w-3 shrink-0 text-slate-400" />
                    <span className="truncate">{ownerName}</span>
                  </span>
                  {total != null && total !== '' && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {parseMoney(total)}
                    </span>
                  )}
                  {items.length > 0 && (
                    <span className="shrink-0 text-slate-500 dark:text-slate-400">
                      · {items.length} producto(s)
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={copyAddress}
                aria-label="Copiar dirección"
                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <a
                href={destination ? navigationUrl(destination) : undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!destination}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition active:scale-95 ${
                  destination
                    ? 'bg-brand text-white hover:bg-brand-dark'
                    : 'pointer-events-none bg-slate-200 text-slate-400 dark:bg-slate-800'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                Ir ahora
              </a>
              {destination ? (
                <a
                  href={wazeUrl(destination)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <RouteIcon className="h-3.5 w-3.5" />
                  Waze
                </a>
              ) : (
                <span className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-400 dark:border-slate-700">
                  Falta geolocalizar
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --------------------------- Controles laterales --------------------------- */}
      <div className="absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            if (myCoords) setCenterTick((t) => t + 1);
          }}
          aria-label="Centrar en mi ubicación"
          title="Mi ubicación"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-900/5 backdrop-blur transition hover:bg-white active:scale-95 dark:bg-slate-900/90 dark:text-white dark:ring-white/10"
        >
          <Crosshair className={`h-5 w-5 ${myCoords ? '' : 'opacity-40'}`} />
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          aria-label={sheetOpen ? 'Ocultar resumen del pedido' : 'Ver resumen del pedido'}
          title="Resumen del pedido"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-900/5 backdrop-blur transition hover:bg-white active:scale-95 dark:bg-slate-900/90 dark:text-white dark:ring-white/10"
        >
          <Package className="h-5 w-5" />
        </button>
      </div>

      {/* --------------------- Estado vacío / de carga --------------------- */}
      {!target && (
        <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center p-6">
          <div className="max-w-xs rounded-2xl bg-white/95 p-4 text-center shadow-xl ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/95 dark:ring-white/10">
            {loadError ? (
              <>
                <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-rose-500" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">No se pudieron cargar las entregas</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{loadError}</p>
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-brand" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">Cargando entregas…</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Sincronizando con el servidor.</p>
              </>
            ) : (
              <>
                <Package className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">Sin entregas activas</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {isDriver
                    ? 'Cuando te asignen un pedido aparecerá aquí automáticamente.'
                    : 'Selecciona una entrega de la lista para ver su recorrido.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ Hoja inferior ------------------------------ */}
      {target && (
        <div className="absolute inset-x-0 bottom-0 z-[1000]">
          <div className="relative rounded-t-3xl border-t border-slate-200 bg-white/95 shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
              className="flex w-full items-center gap-3 px-4 pb-2 pt-2.5 text-left"
            >
              <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="mt-2 flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {items.length ? `${items.length} producto(s) · ${unitCount} unidad(es)` : 'Resumen del pedido'}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {ownerName}
                    {total != null && total !== '' ? ` · ${parseMoney(total)}` : ''}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 p-1.5 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {sheetOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </span>
            </button>

            {sheetOpen && (
              <div className="max-h-[46vh] overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {/* Propietario */}
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Store className="h-3 w-3" /> Propietario del pedido
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">{ownerName}</p>
                    {supplier && (
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">Proveedor: {supplier}</p>
                    )}
                    {ownerPhone && (
                      <a
                        href={`tel:${ownerPhone}`}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-slate-200 transition hover:bg-sky-50 dark:bg-slate-900 dark:text-sky-300 dark:ring-slate-700"
                      >
                        <Phone className="h-3 w-3" /> {ownerPhone}
                      </a>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <User className="h-3 w-3" /> Quién recibe
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                      {requester || ownerName}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {target.driver_name ? `Domiciliario: ${target.driver_name}` : 'Sin domiciliario asignado'}
                      {target.plate ? ` · ${target.plate}` : ''}
                    </p>
                  </div>
                </div>

                {/* Resumen del pedido */}
                <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Resumen del pedido
                    </p>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">{parseMoney(total)}</span>
                  </div>

                  {detailsLoading ? (
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    </div>
                  ) : items.length ? (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.slice(0, 6).map((item) => (
                        <li key={item.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-slate-100 px-1 text-[10px] font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {item.quantity}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-800 dark:text-slate-100">
                            {item.name}
                            {item.unit ? <span className="font-normal text-slate-400"> · {item.unit}</span> : null}
                          </span>
                          <span className="shrink-0 font-bold text-slate-600 dark:text-slate-300">
                            {parseMoney(item.subtotal)}
                          </span>
                        </li>
                      ))}
                      {items.length > 6 && (
                        <li className="px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          +{items.length - 6} producto(s) más en el pedido
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                      Este pedido no tiene detalle de productos registrado.
                    </p>
                  )}

                  {notes && (
                    <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      <span className="font-bold">Notas: </span>
                      {notes}
                    </p>
                  )}
                </div>

                {/* Acciones del pedido */}
                {actions ? (
                  <div className="mt-2 space-y-2">{actions}</div>
                ) : onOpenOrder ? (
                  <button
                    type="button"
                    onClick={() => onOpenOrder(target)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Ver pedido completo
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

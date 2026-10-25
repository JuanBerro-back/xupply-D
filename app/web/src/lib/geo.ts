/**
 * Utilidades geográficas compartidas por las vistas de logística.
 * Antes vivían duplicadas en Deliveries.tsx y DriverDashboard.tsx.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Distancia en km entre dos coordenadas (Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** ETA aproximado usando la velocidad real del GPS o 25 km/h de promedio urbano. */
export function formatEta(km: number, speedKmh?: number | null): string {
  if (!Number.isFinite(km)) return '—';
  const speed = speedKmh && speedKmh > 5 ? speedKmh : 25;
  const minutes = Math.max(1, Math.round((km / speed) * 60));
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h} h ${m} min` : `~${h} h`;
}

export function coordOf(lat?: number | string | null, lng?: number | string | null): LatLng | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || la === 0 || ln === 0) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/**
 * Ruta real por calles con OSRM público. Devuelve null si tarda más de
 * `timeoutMs` o si el servicio falla, para que la vista use la línea
 * aproximada en vez de quedarse esperando.
 */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  timeoutMs = 6000
): Promise<{ points: [number, number][]; distanceKm: number; durationMin: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.code !== 'Ok' || !data.routes?.length) return null;
    const route = data.routes[0];
    return {
      points: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]),
      distanceKm: Number(route.distance) / 1000,
      durationMin: Math.max(1, Math.round(Number(route.duration) / 60)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Enlace universal de navegación (abre la app de mapas instalada en el móvil). */
export function navigationUrl(to: LatLng, label?: string): string {
  const q = label ? `&destination_place_id=&travelmode=driving` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}${q}`;
}

export function wazeUrl(to: LatLng): string {
  return `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`;
}

// Utilidades geoespaciales para seguimiento GPS en tiempo real (zona Bucaramanga).

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distancia en metros entre dos puntos (fórmula de Haversine). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Rumbo en grados (0 = norte) desde un punto hacia otro. */
export function bearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

/**
 * ETA en minutos hasta el destino.
 * Factor 1.4 corrige la distancia en línea recta vs ruta urbana real.
 * Se limita a 180 minutos como tope superior.
 */
export function estimateEtaMinutes(
  lat: number,
  lng: number,
  destLat: number,
  destLng: number,
  speedKmh?: number | null
): number {
  const km = (haversineMeters(lat, lng, destLat, destLng) / 1000) * 1.4;
  if (km < 0.05) return 0;
  const speed = Math.max(Number(speedKmh) || 22, 8); // moto urbana mín. 8 km/h
  return Math.min(180, Math.round((km / speed) * 60));
}

/** Estado derivado del tracker: 'aproximandose' si está dentro de la geocerca. */
export const GEOFENCE_RADIUS_M = 500;

export function insideGeofence(
  lat: number,
  lng: number,
  destLat: number,
  destLng: number
): boolean {
  if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return false;
  return haversineMeters(lat, lng, destLat, destLng) <= GEOFENCE_RADIUS_M;
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    Math.abs(la) <= 90 &&
    Math.abs(ln) <= 180
  );
}

/** Radio aproximado de la línea recta entre dos puntos, para dibujar la polilínea. */
export function slicePolyline(
  points: Array<{ lat: string | number; lng: string | number }>,
  maxPoints = 200
): Array<{ lat: number; lng: number }> {
  const coords = points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  if (coords.length <= maxPoints) return coords;
  const step = coords.length / maxPoints;
  const out: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < maxPoints; i++) out.push(coords[Math.floor(i * step)]);
  return out;
}

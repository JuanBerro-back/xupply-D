"use strict";
// Utilidades geoespaciales para seguimiento GPS en tiempo real (zona Bucaramanga).
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEOFENCE_RADIUS_M = void 0;
exports.haversineMeters = haversineMeters;
exports.bearingDegrees = bearingDegrees;
exports.estimateEtaMinutes = estimateEtaMinutes;
exports.insideGeofence = insideGeofence;
exports.isValidCoord = isValidCoord;
exports.slicePolyline = slicePolyline;
const EARTH_RADIUS_M = 6371000;
function toRad(deg) {
    return (deg * Math.PI) / 180;
}
/** Distancia en metros entre dos puntos (fórmula de Haversine). */
function haversineMeters(lat1, lng1, lat2, lng2) {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}
/** Rumbo en grados (0 = norte) desde un punto hacia otro. */
function bearingDegrees(lat1, lng1, lat2, lng2) {
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}
/**
 * ETA en minutos hasta el destino.
 * Factor 1.4 corrige la distancia en línea recta vs ruta urbana real.
 * Se limita a 180 minutos como tope superior.
 */
function estimateEtaMinutes(lat, lng, destLat, destLng, speedKmh) {
    const km = (haversineMeters(lat, lng, destLat, destLng) / 1000) * 1.4;
    if (km < 0.05)
        return 0;
    const speed = Math.max(Number(speedKmh) || 22, 8); // moto urbana mín. 8 km/h
    return Math.min(180, Math.round((km / speed) * 60));
}
/** Estado derivado del tracker: 'aproximandose' si está dentro de la geocerca. */
exports.GEOFENCE_RADIUS_M = 500;
function insideGeofence(lat, lng, destLat, destLng) {
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng))
        return false;
    return haversineMeters(lat, lng, destLat, destLng) <= exports.GEOFENCE_RADIUS_M;
}
function isValidCoord(lat, lng) {
    const la = Number(lat);
    const ln = Number(lng);
    return (Number.isFinite(la) &&
        Number.isFinite(ln) &&
        Math.abs(la) <= 90 &&
        Math.abs(ln) <= 180);
}
/** Radio aproximado de la línea recta entre dos puntos, para dibujar la polilínea. */
function slicePolyline(points, maxPoints = 200) {
    const coords = points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    if (coords.length <= maxPoints)
        return coords;
    const step = coords.length / maxPoints;
    const out = [];
    for (let i = 0; i < maxPoints; i++)
        out.push(coords[Math.floor(i * step)]);
    return out;
}

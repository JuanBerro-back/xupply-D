import { Delivery } from '../../../shared/types';
import { coordOf, distanceKm } from './geo';

// Las posiciones se toman SOLO de datos reales del backend. Si una entrega
// no tiene coordenadas, la vista lo indica en lugar de inventar un punto.
export function driverPositionFor(
  delivery: Delivery,
  myCoords?: { lat: number; lng: number } | null
): { lat: number; lng: number } | null {
  return coordOf(delivery.vehicle_lat, delivery.vehicle_lng) ?? myCoords ?? null;
}

export function destinationPositionFor(delivery: Delivery): { lat: number; lng: number } | null {
  return coordOf(delivery.dest_lat, delivery.dest_lng);
}

export function calculateDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  return distanceKm(a, b);
}

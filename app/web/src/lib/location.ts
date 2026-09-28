import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
}

export async function requestLocationPermissions(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        return req.location === 'granted';
      }
      return true;
    } catch (e) {
      console.warn('[Location] Error verificando permisos Capacitor:', e);
      return false;
    }
  }
  return true;
}

export async function getExactLocation(): Promise<LocationData | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const granted = await requestLocationPermissions();
      if (granted) {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
          heading: Number.isFinite(pos.coords.heading) ? Math.round(pos.coords.heading as number) : null,
        };
      }
    } catch (e) {
      console.warn('[Location] Fallback de Capacitor a Web:', e);
    }
  }

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
        });
      },
      (err) => {
        console.warn('[Location] Error en navigator.geolocation:', err);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function watchExactLocation(
  onUpdate: (data: LocationData) => void,
  onError?: (err: unknown) => void
): () => void {
  let cancelled = false;
  let capacitorWatchId: string | null = null;
  let browserWatchId: number | null = null;

  if (Capacitor.isNativePlatform()) {
    requestLocationPermissions().then((granted) => {
      if (cancelled || !granted) return;
      Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        (pos, err) => {
          if (cancelled) return;
          if (pos?.coords) {
            onUpdate({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
              speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
              heading: Number.isFinite(pos.coords.heading) ? Math.round(pos.coords.heading as number) : null,
            });
          } else if (err) {
            onError?.(err);
          }
        }
      ).then((id) => {
        if (cancelled) {
          Geolocation.clearWatch({ id });
        } else {
          capacitorWatchId = id;
        }
      }).catch((e) => {
        console.warn('[Location] Error iniciando watchPosition Capacitor:', e);
        onError?.(e);
      });
    });
  } else {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      browserWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          onUpdate({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
            heading: Number.isFinite(pos.coords.heading) ? Math.round(pos.coords.heading as number) : null,
          });
        },
        onError,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }

  return () => {
    cancelled = true;
    if (capacitorWatchId) {
      Geolocation.clearWatch({ id: capacitorWatchId });
    }
    if (browserWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(browserWatchId);
    }
  };
}

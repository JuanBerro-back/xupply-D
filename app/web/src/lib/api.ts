import { Capacitor } from '@capacitor/core';

const TOKEN_KEY = 'xupply_token';
const SERVER_URL_KEY = 'xupply_server_url';
export const DEFAULT_RENDER_URL = 'https://xupply-d.onrender.com';

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return (
    window.location.protocol === 'capacitor:' ||
    Capacitor.isNativePlatform() ||
    Boolean(cap?.isNativePlatform?.()) ||
    cap?.getPlatform?.() === 'android' ||
    cap?.getPlatform?.() === 'ios'
  );
}

export function getApiOrigin(): string {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem(SERVER_URL_KEY);
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/+$/, '');
    }
  }

  const buildUrl = import.meta.env.VITE_API_URL;
  if (buildUrl && buildUrl.trim()) {
    return buildUrl.trim().replace(/\/+$/, '');
  }

  // Si se ejecuta en APK (Capacitor en Android), localhost no tiene backend; usamos Render
  if (isCapacitorNative()) {
    return DEFAULT_RENDER_URL;
  }

  // En la web (despliegue en Vercel, vercel dev o proxy de Vite), origen relativo ""
  return '';
}

export function getApkDownloadUrl(): string {
  // El instalador Xupply.apk se sirve directamente desde la raíz pública de la web
  return '/Xupply.apk?v=' + Date.now();
}

export function setCustomApiOrigin(url: string) {
  if (!url || !url.trim()) {
    localStorage.removeItem(SERVER_URL_KEY);
  } else {
    localStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
  }
}

export function getCustomApiOrigin(): string | null {
  return localStorage.getItem(SERVER_URL_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const origin = getApiOrigin();
  const res = await fetch(`${origin}/api${path}`, { ...options, headers });
  
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  if (!res.ok) {
    if (body && typeof body === 'object') {
      const errorMsg = body.error || body.message || `Error ${res.status}`;
      const detailMsg = body.detail ? `: ${body.detail}` : '';
      const error = new Error(`${errorMsg}${detailMsg}`);
      // Datos estructurados del backend (p. ej. estado de verificación).
      (error as Error & { payload?: unknown; status?: number }).payload = body;
      (error as Error & { payload?: unknown; status?: number }).status = res.status;
      throw error;
    }
    if (text && text.includes('FUNCTION_INVOCATION_FAILED')) {
      throw new Error('Error 500 (Vercel): La función backend falló al invocarse.');
    }
    throw new Error(text && text.length < 150 ? text : `Error ${res.status}`);
  }

  return (body !== null ? body : {}) as T;
}
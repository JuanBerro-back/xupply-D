/**
 * Utilidades del módulo de verificación de cuentas (KYC/KYB empresarial).
 *
 * Reglas de negocio:
 * - Toda cuenta nueva de restaurante o proveedor nace en `pendiente`.
 * - No puede iniciar sesión hasta que un verificador la apruebe.
 * - Se exigen tres documentos: RUT, Cámara de Comercio y cédula del
 *   representante legal.
 * - El NIT se valida con su dígito de verificación antes de crear la cuenta.
 */

export type EntityType = 'restaurante' | 'proveedor';

import { randomBytes } from 'crypto';

export const DOC_TYPES = ['rut', 'camara_comercio', 'cedula_representante'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_LABELS: Record<DocType, string> = {
  rut: 'RUT',
  camara_comercio: 'Cámara de Comercio',
  cedula_representante: 'Cédula del representante legal',
};

/** 3 MB por documento; el cuerpo base64 viaja en una petición por archivo. */
export const MAX_DOC_BYTES = 3 * 1024 * 1024;

export const VERIFICATION_STATUSES = ['pendiente', 'subsanacion', 'verificado', 'rechazado'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export function isEntityType(value: unknown): value is EntityType {
  return value === 'restaurante' || value === 'proveedor';
}

export function isDocType(value: unknown): value is DocType {
  return DOC_TYPES.includes(value as DocType);
}

/**
 * Valida un NIT colombiano con dígito de verificación.
 * Acepta `900123456-7`, `900.123.456-7` o `9001234567`.
 */
export function validateNit(raw: unknown): { ok: boolean; formatted?: string; reason?: string } {
  const value = String(raw ?? '').trim();
  if (!value) return { ok: false, reason: 'El NIT es obligatorio' };

  const cleaned = value.replace(/[.\s]/g, '').replace(/-/g, '');
  if (!/^\d{9,15}$/.test(cleaned)) {
    return { ok: false, reason: 'El NIT debe tener entre 9 y 15 dígitos' };
  }

  const base = cleaned.slice(0, -1);
  const check = Number(cleaned.slice(-1));
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

  // Se multiplica de derecha a izquierda sobre el cuerpo del NIT.
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const digit = Number(base[base.length - 1 - i]);
    sum += digit * (weights[i] ?? 0);
  }
  const remainder = sum % 11;
  const expected = remainder === 0 || remainder === 1 ? remainder : 11 - remainder;

  if (expected !== check) {
    return {
      ok: false,
      reason: `El dígito de verificación del NIT no es válido (debería ser ${expected})`,
    };
  }

  return { ok: true, formatted: `${base}-${check}` };
}

/** Detecta el tipo real del archivo por sus bytes iniciales. */
export function detectDocumentMime(buffer: Buffer): string | null {
  if (buffer.length < 8) return null;
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

export function extensionForMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  return 'png';
}

export function sanitizeFileName(name: unknown, fallback: string): string {
  const raw = String(name ?? '').replace(/[\\/]/g, '').trim();
  const safe = raw.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120);
  return safe || fallback;
}

/**
 * Decodifica un documento enviado como base64 o data URL y valida tamaño y
 * tipo real (no se confía en el `mime_type` declarado por el cliente).
 */
export function decodeDocument(
  input: unknown
): { ok: true; buffer: Buffer; mime: string } | { ok: false; error: string } {
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: 'El archivo está vacío' };
  }
  const base64 = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
    return { ok: false, error: 'El archivo no está codificado en base64' };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, error: 'No se pudo leer el archivo' };
  }

  if (!buffer.length) return { ok: false, error: 'El archivo está vacío' };
  if (buffer.length > MAX_DOC_BYTES) {
    return { ok: false, error: 'Cada documento debe pesar máximo 3 MB' };
  }

  const mime = detectDocumentMime(buffer);
  if (!mime) {
    return { ok: false, error: 'Formato no permitido: solo PDF, JPG o PNG' };
  }
  return { ok: true, buffer, mime };
}

/** Token aleatorio para el enlace público de seguimiento/subsanación. */
export function randomVerificationToken(): string {
  // 32 bytes -> 64 caracteres hex; se usa en una URL y no se indexa.
  return randomBytes(32).toString('hex');
}

export function publicAppUrl(path: string): string {
  const configured = (process.env.APP_PUBLIC_URL || process.env.APP_URL || process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)[0];
  const base = (configured || 'https://xupply-d.vercel.app').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

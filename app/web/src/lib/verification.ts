import { api } from './api';
import { VerificationStatus } from '../types';

export const VERIFICATION_DOC_LABELS: Record<string, string> = {
  rut: 'RUT',
  camara_comercio: 'Cámara de Comercio',
  cedula_representante: 'Cédula del representante legal',
};

export const VERIFICATION_DOCS = ['rut', 'camara_comercio', 'cedula_representante'] as const;
export type VerificationDocType = (typeof VERIFICATION_DOCS)[number];

export const MAX_DOC_BYTES = 3 * 1024 * 1024;
export const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const VERIFICATION_STATUS_META: Record<
  VerificationStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  pendiente: {
    label: 'Pendiente',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    dot: 'bg-amber-500',
    description: 'En cola de revisión por el equipo de verificación.',
  },
  subsanacion: {
    label: 'Corrección solicitada',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    dot: 'bg-sky-500',
    description: 'Faltan correcciones o documentos por parte del solicitante.',
  },
  verificado: {
    label: 'Verificado',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    description: 'La empresa fue validada y puede operar.',
  },
  rechazado: {
    label: 'Rechazado',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    dot: 'bg-rose-500',
    description: 'La solicitud no fue aprobada.',
  },
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Convierte un archivo a data URL base64 validando tipo y tamaño. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      reject(new Error('Formato no permitido: solo PDF, JPG o PNG'));
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      reject(new Error('Cada documento debe pesar máximo 3 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

/**
 * Sube un documento al expediente usando el token del solicitante.
 * El endpoint público lo valida por tipo real (magic bytes) y tamaño.
 */
export async function uploadVerificationDocument(
  token: string,
  docType: VerificationDocType,
  file: File
): Promise<void> {
  const data = await fileToBase64(file);
  await api(`/verification/public/${token}/documents`, {
    method: 'POST',
    body: JSON.stringify({ doc_type: docType, file_name: file.name, data }),
  });
}

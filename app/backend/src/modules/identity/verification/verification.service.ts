import { DocType, DOC_TYPES, EntityType, isEntityType } from '../utils/verification';

import { rateLimit } from '../utils/rateLimit';
export const publicLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, keyPrefix: 'verification:public' });
export const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyPrefix: 'verification:upload' });

export const TABLE: Record<EntityType, string> = { restaurante: 'restaurants', proveedor: 'suppliers' };
export const USER_FK: Record<EntityType, string> = { restaurante: 'restaurant_id', proveedor: 'supplier_id' };

export function tableFor(value: unknown): EntityType | null {
  return isEntityType(value) ? value : null;
}

/** Valida el par `type/id` de las rutas de back office con los mensajes actuales. */
export function parseVerificationTarget(params: { type?: unknown; id?: unknown }):
  | { ok: true; kind: EntityType; id: number }
  | { ok: false; status: number; error: string } {
  const kind = tableFor(params.type);
  if (!kind) return { ok: false, status: 400, error: 'Tipo de entidad no válido' };
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 400, error: 'ID no válido' };
  return { ok: true, kind, id };
}

export function kindLabel(kind: EntityType): string {
  return kind === 'restaurante' ? 'restaurante' : 'proveedor';
}

export function isPendingStatus(status: string): boolean {
  return status === 'pendiente' || status === 'subsanacion';
}

export function missingFrom(docs: Array<{ doc_type: string }>): DocType[] {
  const present = new Set(docs.map((doc) => doc.doc_type));
  return DOC_TYPES.filter((doc) => !present.has(doc));
}

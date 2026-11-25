import { query } from '../../../shared/config/db';
import { EntityType } from '../utils/verification';
import { EntityRow } from './verification.types';

/** Busca la entidad por el token pÃºblico (no enumerable). */
export async function findByToken(token: string): Promise<EntityRow | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const result = await query(
    `SELECT 'restaurante' AS entity_type, r.id, r.name, r.nit, r.email, r.phone, r.address, r.city,
            r.legal_rep_name, r.legal_rep_document, r.verification_status, r.verification_reason,
            r.submitted_at, r.created_at
       FROM restaurants r
      WHERE r.verification_token = $1
      UNION ALL
     SELECT 'proveedor' AS entity_type, s.id, s.name, s.nit, s.email, s.phone, s.address, s.city,
            s.legal_rep_name, s.legal_rep_document, s.verification_status, s.verification_reason,
            s.submitted_at, s.created_at
       FROM suppliers s
      WHERE s.verification_token = $1
      LIMIT 1`,
    [token]
  );
  return result.rowCount ? (result.rows[0] as EntityRow) : null;
}

export async function documentsOf(kind: EntityType, id: number) {
  const result = await query(
    `SELECT doc_type, file_name, mime_type, size_bytes, uploaded_at
       FROM verification_documents
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY uploaded_at`,
    [kind, id]
  );
  return result.rows;
}

export async function recordEvent(params: {
  kind: EntityType;
  id: number;
  action: string;
  from?: string | null;
  to?: string | null;
  reason?: string | null;
  actorId?: number | null;
  actorName?: string | null;
}) {
  await query(
    `INSERT INTO verification_events
       (entity_type, entity_id, action, status_from, status_to, reason, actor_id, actor_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      params.kind,
      params.id,
      params.action,
      params.from ?? null,
      params.to ?? null,
      params.reason ?? null,
      params.actorId ?? null,
      params.actorName ?? null,
    ]
  );
}

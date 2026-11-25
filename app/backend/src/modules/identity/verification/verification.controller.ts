import { Request, Response, NextFunction } from 'express';
import { pool, query } from '../../../shared/config/db';
import { logAudit } from '../../../shared/lib/audit';
import {
  DOC_LABELS,
  DOC_TYPES,
  DocType,
  EntityType,
  decodeDocument,
  extensionForMime,
  isDocType,
  randomVerificationToken,
  sanitizeFileName,
  validateNit,
  VERIFICATION_STATUSES,
  VerificationStatus,
} from '../utils/verification';
import { notifyReviewersForEntity, sendVerificationDecision } from '../utils/verificationEmails';
import { TABLE, USER_FK, parseVerificationTarget, isPendingStatus, missingFrom } from './verification.service';
import { findByToken, documentsOf, recordEvent } from './verification.repository';

/* ------------------------------------------------------------------ */
/* API pública para el solicitante (enlace con token)                  */
/* ------------------------------------------------------------------ */
export async function getPublicRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const entity = await findByToken(req.params.token);
    if (!entity) return res.status(404).json({ error: 'Enlace inválido o vencido' });

    const docs = await documentsOf(entity.entity_type, entity.id);
    res.json({
      entity_type: entity.entity_type,
      name: entity.name,
      nit: entity.nit,
      city: entity.city,
      status: entity.verification_status,
      reason: entity.verification_reason,
      submitted_at: entity.submitted_at,
      created_at: entity.created_at,
      can_upload: isPendingStatus(entity.verification_status),
      can_submit: entity.verification_status === 'subsanacion' && missingFrom(docs).length === 0,
      documents: docs,
      missing: missingFrom(docs),
      required_documents: DOC_TYPES.map((doc) => ({ type: doc, label: DOC_LABELS[doc] })),
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = await findByToken(req.params.token);
      if (!entity) return res.status(404).json({ error: 'Enlace inválido o vencido' });
      if (!isPendingStatus(entity.verification_status)) {
        return res.status(409).json({
          error:
            entity.verification_status === 'verificado'
              ? 'La cuenta ya fue aprobada; no es necesario cargar documentos.'
              : 'La cuenta fue rechazada. Responde al correo de verificación para reabrir el caso.',
        });
      }

      const docType = req.body?.doc_type;
      if (!isDocType(docType)) {
        return res.status(400).json({ error: 'Tipo de documento no válido' });
      }

      const decoded = decodeDocument(req.body?.data);
      if (!decoded.ok) return res.status(400).json({ error: decoded.error });

      const fileName = sanitizeFileName(
        req.body?.file_name,
        `${docType}.${extensionForMime(decoded.mime)}`
      );

      // El índice único garantiza una sola versión vigente por documento.
      await query(
        `INSERT INTO verification_documents
           (entity_type, entity_id, doc_type, file_name, mime_type, size_bytes, file_data, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)
         ON CONFLICT (entity_type, entity_id, doc_type)
         DO UPDATE SET file_name = EXCLUDED.file_name,
                       mime_type = EXCLUDED.mime_type,
                       size_bytes = EXCLUDED.size_bytes,
                       file_data = EXCLUDED.file_data,
                       uploaded_at = CURRENT_TIMESTAMP`,
        [entity.entity_type, entity.id, docType, fileName, decoded.mime, decoded.buffer.length, decoded.buffer]
      );

      await recordEvent({
        kind: entity.entity_type,
        id: entity.id,
        action: 'documento_cargado',
        reason: DOC_LABELS[docType],
        actorName: entity.name,
      });

      const docs = await documentsOf(entity.entity_type, entity.id);
      const missing = missingFrom(docs);
      const status = entity.verification_status;

      // En el primer envío se avisa al equipo cuando el expediente queda completo.
      // En subsanación el solicitante decide cuándo reenviar (POST /submit).
      if (missing.length === 0 && status === 'pendiente') {
        const completeEvent = await query(
          `SELECT 1 FROM verification_events
            WHERE entity_type = $1 AND entity_id = $2 AND action = 'expediente_completo'
            LIMIT 1`,
          [entity.entity_type, entity.id]
        );
        if (!completeEvent.rowCount) {
          await recordEvent({
            kind: entity.entity_type,
            id: entity.id,
            action: 'expediente_completo',
            from: status,
            to: 'pendiente',
            actorName: entity.name,
          });
          void notifyReviewersForEntity({ entity, token: req.params.token }).catch((err) =>
            console.warn('[verification] No se pudo avisar al equipo:', err)
          );
        }
      }

      res.status(201).json({
        ok: true,
        doc_type: docType,
        missing,
        status,
        documents: docs,
      });
    } catch (err) {
      next(err);
    }
}

/* ------------------------------------------------------------------ */
/* Reenvío tras una corrección solicitada                              */
/* ------------------------------------------------------------------ */
export async function submitCorrection(req: Request, res: Response, next: NextFunction) {
  try {
    const entity = await findByToken(req.params.token);
    if (!entity) return res.status(404).json({ error: 'Enlace inválido o vencido' });
    if (entity.verification_status === 'verificado') {
      return res.status(409).json({ error: 'La cuenta ya está aprobada.' });
    }
    if (entity.verification_status === 'rechazado') {
      return res.status(409).json({ error: 'La cuenta fue rechazada. Responde al correo de verificación.' });
    }
    if (entity.verification_status !== 'subsanacion') {
      return res.status(400).json({ error: 'No hay correcciones pendientes por reenviar.' });
    }

    const docs = await documentsOf(entity.entity_type, entity.id);
    const missing = missingFrom(docs);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Faltan documentos: ${missing.map((doc) => DOC_LABELS[doc]).join(', ')}`,
      });
    }

    await query(
      `UPDATE ${TABLE[entity.entity_type]}
          SET verification_status = 'pendiente',
              verification_reason = NULL,
              submitted_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [entity.id]
    );
    await recordEvent({
      kind: entity.entity_type,
      id: entity.id,
      action: 'expediente_completo',
      from: 'subsanacion',
      to: 'pendiente',
      actorName: entity.name,
    });

    void notifyReviewersForEntity({ entity, token: req.params.token }).catch((err) =>
      console.warn('[verification] No se pudo avisar al equipo:', err)
    );

    res.json({ ok: true, status: 'pendiente' });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Back office (verificador / admin)                                   */
/* ------------------------------------------------------------------ */
export async function summary(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT verification_status, COUNT(*)::int AS count
         FROM (
           SELECT verification_status FROM restaurants
           UNION ALL
           SELECT verification_status FROM suppliers
         ) v
        GROUP BY verification_status`
    );
    const counts: Record<string, number> = {
      pendiente: 0,
      subsanacion: 0,
      verificado: 0,
      rechazado: 0,
    };
    for (const row of result.rows) counts[row.verification_status] = Number(row.count);
    counts.total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    res.json(counts);
  } catch (err) {
    next(err);
  }
}

export async function requests(req: Request, res: Response, next: NextFunction) {
  try {
    const status = String(req.query.status ?? 'pendiente');
    if (status !== 'todas' && !VERIFICATION_STATUSES.includes(status as VerificationStatus)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    const q = String(req.query.q ?? '').trim().slice(0, 80);
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '30'), 10) || 30));
    const offset = (page - 1) * limit;

    const base = `
      SELECT 'restaurante' AS entity_type, r.id, r.name, r.nit, r.email, r.phone, r.address, r.city,
             r.legal_rep_name, r.legal_rep_document, r.verification_status, r.verification_reason,
             r.submitted_at, r.created_at,
             (SELECT COUNT(*)::int FROM verification_documents d
               WHERE d.entity_type = 'restaurante' AND d.entity_id = r.id) AS documents,
             (SELECT COUNT(*)::int FROM users u WHERE u.restaurant_id = r.id) AS users_count
        FROM restaurants r
      UNION ALL
      SELECT 'proveedor' AS entity_type, s.id, s.name, s.nit, s.email, s.phone, s.address, s.city,
             s.legal_rep_name, s.legal_rep_document, s.verification_status, s.verification_reason,
             s.submitted_at, s.created_at,
             (SELECT COUNT(*)::int FROM verification_documents d
               WHERE d.entity_type = 'proveedor' AND d.entity_id = s.id) AS documents,
             (SELECT COUNT(*)::int FROM users u WHERE u.supplier_id = s.id) AS users_count
        FROM suppliers s`;

    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (status !== 'todas') {
      params.push(status);
      where += ` AND v.verification_status = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (v.name ILIKE $${params.length} OR v.nit ILIKE $${params.length} OR v.email ILIKE $${params.length})`;
    }

    const totalResult = await query(`SELECT COUNT(*)::int AS total FROM (${base}) v ${where}`, params);
    params.push(limit, offset);
    const rows = await query(
      `SELECT v.* FROM (${base}) v ${where}
        ORDER BY v.submitted_at DESC NULLS LAST, v.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      total: totalResult.rows[0]?.total ?? 0,
      page,
      limit,
      items: rows.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function requestDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const target = parseVerificationTarget(req.params);
    if (!target.ok) return res.status(target.status).json({ error: target.error });
    const { kind, id } = target;

    const entityResult = await query(
      `SELECT id, name, nit, email, phone, address, city, department, category,
              legal_rep_name, legal_rep_document,
              verification_status, verification_reason, submitted_at, created_at,
              verified_at, verified_by
         FROM ${TABLE[kind]} WHERE id = $1`,
      [id]
    );
    if (!entityResult.rowCount) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const entity = entityResult.rows[0];

    const [docs, events, users, otherEntity] = await Promise.all([
      documentsOf(kind, id),
      query(
        `SELECT id, action, status_from, status_to, reason, actor_name, created_at
           FROM verification_events
          WHERE entity_type = $1 AND entity_id = $2
          ORDER BY created_at DESC, id DESC
          LIMIT 60`,
        [kind, id]
      ),
      query(
        `SELECT u.id, u.name, u.username, u.email, u.phone, u.is_active, u.last_login, u.created_at
           FROM users u WHERE u.${USER_FK[kind]} = $1 ORDER BY u.id`,
        [id]
      ),
      query(
        `SELECT COUNT(*)::int AS count FROM ${kind === 'restaurante' ? 'suppliers' : 'restaurants'}
          WHERE nit = $1`,
        [entity.nit]
      ),
    ]);

    const missing = missingFrom(docs);
    const nitCheck = validateNit(entity.nit);
    const emailDuplicate = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM users
           WHERE lower(email) = lower($1) AND ${USER_FK[kind]} IS DISTINCT FROM $2) +
         (SELECT COUNT(*)::int FROM restaurants
           WHERE lower(email) = lower($1) ${kind === 'restaurante' ? 'AND id <> $2' : ''}) +
         (SELECT COUNT(*)::int FROM suppliers
           WHERE lower(email) = lower($1) ${kind === 'proveedor' ? 'AND id <> $2' : ''}) AS count`,
      [entity.email ?? '', id]
    );

    res.json({
      entity_type: kind,
      entity,
      documents: docs,
      events: events.rows,
      users: users.rows,
      missing,
      checks: {
        nit_valid: nitCheck.ok,
        nit_reason: nitCheck.reason ?? null,
        nit_formatted: nitCheck.formatted ?? null,
        nit_duplicate_other_type: Number(otherEntity.rows[0]?.count ?? 0) > 0,
        email_duplicate_count: Number(emailDuplicate.rows[0]?.count ?? 0),
        documents_complete: missing.length === 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const target = parseVerificationTarget(req.params);
    const docType = req.params.docType;
    if (!target.ok || !isDocType(docType)) {
      return res.status(400).json({ error: 'Documento no válido' });
    }
    const { kind, id } = target;

    const result = await query(
      `SELECT file_name, mime_type, file_data
         FROM verification_documents
        WHERE entity_type = $1 AND entity_id = $2 AND doc_type = $3`,
      [kind, id, docType]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Documento no encontrado' });

    const doc = result.rows[0];
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(doc.file_data);
  } catch (err) {
    next(err);
  }
}

export async function decision(req: Request, res: Response, next: NextFunction) {
  const target = parseVerificationTarget(req.params);
  if (!target.ok) return res.status(target.status).json({ error: target.error });
  const { kind, id } = target;

  const decision = String(req.body?.decision ?? '');
  if (!['aprobar', 'rechazar', 'subsanar'].includes(decision)) {
    return res.status(400).json({ error: 'Decisión no válida' });
  }
  const reason = String(req.body?.reason ?? '').trim().slice(0, 1000);
  if (decision !== 'aprobar' && reason.length < 5) {
    return res.status(400).json({ error: 'Explica el motivo (mínimo 5 caracteres)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const entityResult = await client.query(
      `SELECT id, name, nit, email, verification_status, verification_token
         FROM ${TABLE[kind]} WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!entityResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    const entity = entityResult.rows[0];

    if (entity.verification_status === 'verificado' && decision === 'aprobar') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La cuenta ya está aprobada' });
    }

    const docs = await client.query(
      `SELECT doc_type FROM verification_documents WHERE entity_type = $1 AND entity_id = $2`,
      [kind, id]
    );
    const missing = missingFrom(docs.rows as Array<{ doc_type: string }>);
    if (decision === 'aprobar' && missing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `No se puede aprobar: faltan ${missing.map((doc) => DOC_LABELS[doc]).join(', ')}`,
      });
    }

    const nextStatus: VerificationStatus = decision === 'aprobar' ? 'verificado' : decision === 'rechazar' ? 'rechazado' : 'subsanacion';
    const active = decision === 'aprobar';
    // Las cuentas heredadas pueden no tener token: se genera para que el
    // solicitante pueda seguir el caso o volver a cargar documentos.
    const verificationToken = entity.verification_token || randomVerificationToken();

    await client.query(
      `UPDATE ${TABLE[kind]}
          SET verification_status = $1,
              verification_reason = $2,
              verification_token = $6,
              verified_at = CASE WHEN $1 = 'verificado' THEN CURRENT_TIMESTAMP ELSE NULL END,
              verified_by = $3,
              is_active = $4
        WHERE id = $5`,
      [nextStatus, decision === 'aprobar' ? null : reason, req.user!.id, active, id, verificationToken]
    );

    // Refuerzo: la cuenta no puede operar hasta estar aprobada.
    await client.query(
      `UPDATE users
          SET is_active = $1,
              token_version = token_version + 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE ${USER_FK[kind]} = $2`,
      [active, id]
    );

    await client.query(
      `INSERT INTO verification_events
         (entity_type, entity_id, action, status_from, status_to, reason, actor_id, actor_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        kind,
        id,
        decision === 'aprobar' ? 'aprobado' : decision === 'rechazar' ? 'rechazado' : 'subsanacion_solicitada',
        entity.verification_status,
        nextStatus,
        decision === 'aprobar' ? null : reason,
        req.user!.id,
        req.user!.name ?? req.user!.username,
      ]
    );

    await client.query('COMMIT');

    await logAudit(
      req,
      decision === 'aprobar' ? 'verificacion:aprobar' : decision === 'rechazar' ? 'verificacion:rechazar' : 'verificacion:subsanar',
      kind === 'restaurante' ? 'restaurant' : 'supplier',
      id,
      { verification_status: entity.verification_status },
      { verification_status: nextStatus, reason: reason || null }
    );

    if (entity.email) {
      void sendVerificationDecision({
        kind,
        name: entity.name,
        email: entity.email,
        decision: decision as 'aprobar' | 'rechazar' | 'subsanar',
        reason,
        token: verificationToken,
      }).catch((err) => console.warn('[verification] No se pudo enviar la decisión por correo:', err));
    }

    res.json({ ok: true, status: nextStatus });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
}

export async function addNote(req: Request, res: Response, next: NextFunction) {
  try {
    const target = parseVerificationTarget(req.params);
    const note = String(req.body?.note ?? '').trim().slice(0, 1000);
    if (!target.ok) return res.status(target.status).json({ error: target.error });
    if (note.length < 2) return res.status(400).json({ error: 'Escribe una nota' });
    const { kind, id } = target;

    const exists = await query(`SELECT 1 FROM ${TABLE[kind]} WHERE id = $1`, [id]);
    if (!exists.rowCount) return res.status(404).json({ error: 'Solicitud no encontrada' });

    await recordEvent({
      kind,
      id,
      action: 'nota',
      reason: note,
      actorId: req.user!.id,
      actorName: req.user!.name ?? req.user!.username,
    });
    await logAudit(req, 'verificacion:nota', kind === 'restaurante' ? 'restaurant' : 'supplier', id, null, { note });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

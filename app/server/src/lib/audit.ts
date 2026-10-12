import { Request } from 'express';
import { query } from '../config/db';
import { emitAuditActivity } from './realtime';

export async function logAudit(req: Request, action: string, entity_type: string, entity_id: number | null, old_values: any, new_values: any) {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const cleanOld = old_values ? { ...old_values } : null;
    const cleanNew = new_values ? { ...new_values } : null;
    
    if (cleanOld && 'password_hash' in cleanOld) delete cleanOld.password_hash;
    if (cleanNew && 'password_hash' in cleanNew) delete cleanNew.password_hash;
    if (cleanOld && 'password' in cleanOld) delete cleanOld.password;
    if (cleanNew && 'password' in cleanNew) delete cleanNew.password;
    
    const res = await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [req.user?.id, action, entity_type, entity_id, cleanOld ? JSON.stringify(cleanOld) : null, cleanNew ? JSON.stringify(cleanNew) : null, ip]
    );

    const auditId = res.rows[0]?.id;
    const createdAt = res.rows[0]?.created_at || new Date().toISOString();

    emitAuditActivity({
      id: auditId,
      user_id: req.user?.id || null,
      username: req.user?.username || (cleanNew?.username || 'sistema'),
      user_name: req.user?.name || req.user?.username || (cleanNew?.name || 'Sistema'),
      action,
      entity_type,
      entity_id,
      old_values: cleanOld,
      new_values: cleanNew,
      ip_address: ip,
      created_at: createdAt,
    });
  } catch (err) {
    console.error('[Audit Log Error]', { action, entity_type, entity_id }, err);
  }
}

import { Request, Response, NextFunction } from 'express';
import { query } from '../../shared/config/db';
import { clearPermissionCache } from '../../shared/middleware/auth';
import bcrypt from 'bcryptjs';
import { logAudit } from '../../shared/lib/audit';
import { emitToUser, emitToRole } from '../../shared/lib/realtime';
import { getEmailStatus, sendTestEmail, checkEmailDns } from '../../shared/lib/email';
import { normalizeTenantIdsForRole, validateTenantScope } from '../../shared/lib/userTenant';
import { pagination } from './admin.service';
import { usernameExists, getRoleName, restaurantExists, branchExists, supplierExists, findUserById, countActiveAdmins, listRoles as listRolesRow, findRoleById, roleNameExists, findRole, updatePassword, forceLogout, deleteUser as deleteUserRow } from './admin.repository';

export async function getAuditLog(req: Request, res: Response, next: NextFunction) {
  try {
    const { entity_type, entity_id, user_id, action, from, to, page = '1', limit = '50' } = req.query;
    
    let sql = `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values, a.ip_address, a.created_at,
                      u.username, u.name AS user_name
               FROM audit_log a
               LEFT JOIN users u ON a.user_id = u.id
               WHERE 1=1`;
    const params: unknown[] = [];
    
    if (entity_type) {
      params.push(entity_type);
      sql += ` AND a.entity_type = $${params.length}`;
    }
    
    if (entity_id) {
      params.push(Number(entity_id));
      sql += ` AND a.entity_id = $${params.length}`;
    }
    
    if (user_id) {
      params.push(Number(user_id));
      sql += ` AND a.user_id = $${params.length}`;
    }
    
    if (action) {
      params.push(action);
      sql += ` AND a.action = $${params.length}`;
    }
    
    if (from) {
      params.push(from);
      sql += ` AND a.created_at >= $${params.length}::timestamp`;
    }
    if (to) {
      params.push(to);
      sql += ` AND a.created_at <= $${params.length}::timestamp`;
    }
    
    const countResult = await query(`SELECT COUNT(*) FROM (${sql}) AS t`, params);
    const total = parseInt(countResult.rows[0].count, 10);
    
    const { page: p, limit: l, offset } = pagination(page, limit, 50, 200);
    sql += ` ORDER BY a.created_at DESC LIMIT ${l} OFFSET ${offset}`;
    
    const result = await query(sql, params);
    
    res.json({
      data: result.rows,
      meta: { total, page: p, limit: l, pages: Math.ceil(total / l) }
    });
  } catch (err) {
    next(err);
  }
}

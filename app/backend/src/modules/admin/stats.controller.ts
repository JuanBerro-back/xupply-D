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

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { date_range } = req.query; // 'hoy', '7d', '30d', 'all'
    let dateFilterOrders = '';
    let dateFilterInvoices = '';
    let dateFilterDeliveries = '';
    
    if (date_range === 'hoy') {
      dateFilterOrders = "AND date(created_at) = CURRENT_DATE";
      dateFilterInvoices = "AND date(issued_at) = CURRENT_DATE";
      dateFilterDeliveries = "AND date(created_at) = CURRENT_DATE";
    } else if (date_range === '7d') {
      dateFilterOrders = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
      dateFilterInvoices = "AND issued_at >= CURRENT_DATE - INTERVAL '7 days'";
      dateFilterDeliveries = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (date_range === '30d' || !date_range) { // default 30d
      dateFilterOrders = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
      dateFilterInvoices = "AND issued_at >= CURRENT_DATE - INTERVAL '30 days'";
      dateFilterDeliveries = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const stats: any = {};
    
    // KPI 1: Ingresos del periodo
    const kpi = await query(`
      SELECT 
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status IN ('emitida', 'pagada') ${dateFilterInvoices})::float8 AS revenue,
        (SELECT COUNT(*) FROM orders WHERE status != 'cancelado' ${dateFilterOrders})::float8 AS orders_count,
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status != 'cancelado' ${dateFilterOrders})::float8 AS avg_ticket,
        (SELECT COUNT(*) FROM deliveries WHERE status = 'fallido' ${dateFilterDeliveries})::float8 / GREATEST((SELECT COUNT(*) FROM deliveries WHERE 1=1 ${dateFilterDeliveries}), 1) * 100 AS failed_delivery_pct,
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (actual_delivery_time - scheduled_time))/60), 0) FROM deliveries WHERE actual_delivery_time IS NOT NULL AND status = 'entregado' ${dateFilterDeliveries})::float8 AS avg_delivery_delay_min,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status != 'cancelado' ${dateFilterOrders})::float8 AS gmv_total,
        (SELECT COUNT(*) FROM inventory WHERE stock_status = 'critical')::float8 AS critical_items,
        (SELECT COUNT(*) FROM inventory WHERE expiry_date <= CURRENT_DATE + interval '7 days')::float8 AS expiring_items,
        (SELECT COUNT(*) FROM suppliers WHERE is_active = TRUE)::float8 AS active_suppliers
    `);
    
    stats.kpis = kpi.rows[0];

    // Gr├íficos: Ventas por d├¡a
    const salesByDay = await query(`
      SELECT date(created_at) as date, SUM(total)::float8 as total
      FROM orders
      WHERE status != 'cancelado' ${dateFilterOrders}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `);
    stats.sales_by_day = salesByDay.rows;

    // Pedidos por estado
    const ordersByStatus = await query(`
      SELECT status, COUNT(*)::float8 as count
      FROM orders
      WHERE 1=1 ${dateFilterOrders}
      GROUP BY status
    `);
    stats.orders_by_status = ordersByStatus.rows;

    // Top Productos
    const topProducts = await query(`
      SELECT p.name, SUM(i.quantity)::float8 as qty, SUM(i.subtotal)::float8 as total
      FROM order_items i
      JOIN products p ON p.id = i.product_id
      JOIN orders o ON o.id = i.order_id
      WHERE o.status != 'cancelado' ${dateFilterOrders.replace(/created_at/g, 'o.created_at')}
      GROUP BY p.name
      ORDER BY qty DESC
      LIMIT 10
    `);
    stats.top_products = topProducts.rows;

    // Top Proveedores
    const topSuppliers = await query(`
      SELECT s.name, SUM(o.total)::float8 as total, COUNT(o.id)::float8 as orders
      FROM orders o
      JOIN suppliers s ON s.id = o.supplier_id
      WHERE o.status != 'cancelado' ${dateFilterOrders.replace(/created_at/g, 'o.created_at')}
      GROUP BY s.name
      ORDER BY total DESC
      LIMIT 5
    `);
    stats.top_suppliers = topSuppliers.rows;

    // Actividad reciente
    const recentActivity = await query(`
      SELECT a.action, a.entity_type, a.created_at, u.name as user_name
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 15
    `);
    stats.recent_activity = recentActivity.rows;

    res.json(stats);
  } catch (err) {
    next(err);
  }
}

import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { emitToUser } from '../lib/realtime';

const router = Router();
router.use(authRequired);

function productBaseSelect() {
  return `SELECT p.*, pc.name AS category, pc.id AS category_id, s.name AS supplier_name
          FROM products p
          JOIN product_categories pc ON pc.id = p.category_id
          JOIN suppliers s ON s.id = p.supplier_id`;
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const { category_id, supplier_id, search } = req.query;
    const params: unknown[] = [];
    let sql = `${productBaseSelect()} WHERE p.is_active = TRUE`;
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      params.push(user.supplier_id);
      sql += ` AND p.supplier_id = $${params.length}`;
    } else if (supplier_id) {
      params.push(supplier_id);
      sql += ` AND p.supplier_id = $${params.length}`;
    }
    if (user.role !== 'proveedor_admin') sql += ' AND p.stock_available > 0';
    if (category_id) {
      params.push(category_id);
      sql += ` AND p.category_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND p.name ILIKE $${params.length}`;
    }
    sql += ' ORDER BY pc.sort_order, p.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${productBaseSelect()} WHERE p.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { name, category_id, description, sku, unit, price_per_unit, min_order_qty, stock_available, image_url } =
      req.body;
    if (!name || !price_per_unit) {
      return res.status(400).json({ error: 'name y price_per_unit son requeridos' });
    }

    // El proveedor SIEMPRE sale del usuario autenticado. Un admin puede indicarlo
    // explícitamente, pero se valida que exista. Antes, si faltaba supplier_id,
    // el código "adivinaba" un proveedor por email/nombre (o el primero de la
    // tabla) y podía asignar el producto —y al usuario— a otro inquilino.
    let supplierId: number | null = user.supplier_id ? Number(user.supplier_id) : null;

    if (user.role === 'admin') {
      const requested = req.body.supplier_id ? Number(req.body.supplier_id) : null;
      if (!requested) {
        return res.status(400).json({ error: 'supplier_id es requerido para un administrador' });
      }
      const supCheck = await query('SELECT 1 FROM suppliers WHERE id = $1', [requested]);
      if (!supCheck.rowCount) {
        return res.status(400).json({ error: `El supplier_id ${requested} no existe` });
      }
      supplierId = requested;
    }

    if (!supplierId) {
      return res.status(403).json({
        error: 'Tu usuario no tiene un proveedor asociado. Contacta al administrador.',
      });
    }

    const result = await query(
      `INSERT INTO products (supplier_id, category_id, name, description, sku, unit, price_per_unit, min_order_qty, stock_available, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [supplierId, category_id ? Number(category_id) : null, name, description, sku, unit ?? 'kg', price_per_unit, min_order_qty ?? 1, stock_available ?? 0, image_url]
    );
    emitToUser('notification:created', user.id, { message: `Producto ${name} creado` });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const current = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });

    // Default-deny: solo el proveedor dueño del producto (o un admin) puede
    // modificarlo. Antes, si `user.supplier_id` era null (cualquier gerente,
    // empleado o domiciliario), la comprobación se saltaba y se podía cambiar
    // el precio/stock de productos de CUALQUIER proveedor.
    const isOwner =
      user.role === 'admin' ||
      (user.role === 'proveedor_admin' &&
        Boolean(user.supplier_id) &&
        Number(current.rows[0].supplier_id) === Number(user.supplier_id));
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    const { name, category_id, description, sku, unit, price_per_unit, min_order_qty, stock_available, image_url, is_active } =
      req.body;
    const result = await query(
      `UPDATE products
       SET name = COALESCE($2, name), category_id = COALESCE($3, category_id),
            description = COALESCE($4, description), sku = COALESCE($5, sku),
            unit = COALESCE($6, unit), price_per_unit = COALESCE($7, price_per_unit),
            min_order_qty = COALESCE($8, min_order_qty),
            stock_available = COALESCE($9, stock_available),
            image_url = COALESCE($10, image_url),
            is_active = COALESCE($11, is_active),
            updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, category_id, description, sku, unit, price_per_unit, min_order_qty, stock_available, image_url, is_active]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const current = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    const isOwner =
      user.role === 'admin' ||
      (user.role === 'proveedor_admin' &&
        Boolean(user.supplier_id) &&
        Number(current.rows[0].supplier_id) === Number(user.supplier_id));
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    await query('UPDATE products SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
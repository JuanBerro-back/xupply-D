import { pool } from '../config/db';

export interface OCDraftItem {
  product_id: string | number;
  quantity: string | number;
}

export interface OCSupplierItem {
  product_id: number;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export async function createPurchaseOrderDraft(opts: {
  restaurantId: number;
  createdBy: number | null;
  supplierId: string | number;
  items: OCDraftItem[];
  notes?: string | null;
}) {
  const { restaurantId, createdBy, supplierId, items, notes = null } = opts;
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    throw new Error('supplier_id e items[] son requeridos');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prodIds = items.map((it) => Number(it.product_id)).filter((n) => !isNaN(n));
    const priceMap = new Map<number, { id: number; name: string; unit: string; price_per_unit: string | number }>();
    if (prodIds.length > 0) {
      const inArr = prodIds.map((_, i) => `$${i + 1}`).join(',');
      const p = await client.query(
        `SELECT id, name, unit, price_per_unit FROM products WHERE id IN (${inArr}) AND is_active=TRUE`,
        prodIds
      );
      for (const r of p.rows) priceMap.set(r.id, r);
    }

    let subtotal = 0;
    const orderItems: OCSupplierItem[] = [];
    for (const it of items) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      if (!pid || isNaN(qty) || qty <= 0) continue;
      const p = priceMap.get(pid);
      if (!p) throw new Error(`Producto ${pid} no encontrado o inactivo`);
      const unitPrice = Number(p.price_per_unit);
      const sub = unitPrice * qty;
      subtotal += sub;
      orderItems.push({ product_id: pid, name: p.name, unit: p.unit, quantity: qty, unit_price: unitPrice, subtotal: sub });
    }
    if (orderItems.length === 0) throw new Error('No hay ítems válidos');

    const code = `PO-${Date.now().toString(36).toUpperCase()}`;
    const o = await client.query(
      `INSERT INTO purchase_orders (order_code, restaurant_id, supplier_id, status, subtotal, total, notes, created_by)
       VALUES ($1,$2,$3,'borrador',$4,$5,$6,$7) RETURNING *`,
      [code, restaurantId, supplierId, subtotal, subtotal, notes || null, createdBy]
    );
    const poId = o.rows[0].id;

    for (const it of orderItems) {
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, name, quantity, unit, unit_price, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [poId, it.product_id, it.name, it.quantity, it.unit, it.unit_price, it.subtotal]
      );
    }

    await client.query('COMMIT');
    return { purchase_order: o.rows[0] as any, items: orderItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
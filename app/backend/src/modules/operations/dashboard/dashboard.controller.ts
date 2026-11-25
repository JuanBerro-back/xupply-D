import { Request, Response, NextFunction } from 'express';
import { query } from '../../../shared/config/db';
import { categoryPhotos, announcements } from './dashboard.service';
import { getSupplierCategory, getRestaurantCategory, getDailySuggestions, getDailyDiscounts, getRawSuppliers, getRestDirectory, getSupplierListing } from './dashboard.repository';

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const isSupplier = user.role === 'proveedor_admin' && !!user.supplier_id;
    const isRestaurant = !!user.restaurant_id;
    const isDomiciliario = user.role === 'domiciliario';

    // Clausula WHERE segura para órdenes
    let orderWhere = '';
    const orderParams: unknown[] = [];
    if (isSupplier) {
      orderParams.push(user.supplier_id);
      orderWhere = ' WHERE o.supplier_id = $1';
    } else if (user.restaurant_id) {
      orderParams.push(user.restaurant_id);
      orderWhere = ' WHERE o.restaurant_id = $1';
    }

    // Pedidos generales y métricas
    const ordersRes = await query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN o.status = 'nuevo' THEN 1 ELSE 0 END), 0)::int AS nuevos,
              COALESCE(SUM(CASE WHEN o.status NOT IN ('entregado','cancelado') THEN 1 ELSE 0 END), 0)::int AS activos,
              COALESCE(SUM(o.total), 0)::float AS monto_total
       FROM orders o${orderWhere}`,
      orderParams
    );

    // Clausula WHERE segura para productos (los productos SOLO tienen supplier_id, NO tienen restaurant_id)
    let prodWhere = '';
    const prodParams: unknown[] = [];
    if (isSupplier) {
      prodParams.push(user.supplier_id);
      prodWhere = ' WHERE p.supplier_id = $1';
    }
    const productsRes = await query(
      `SELECT COUNT(*)::int AS total FROM products p${prodWhere}`,
      prodParams
    );

    const recentRes = await query(
      `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       JOIN suppliers s ON s.id = o.supplier_id
       ${orderWhere}
       ORDER BY o.created_at DESC LIMIT 5`,
      orderParams
    );

    const orders = ordersRes.rows[0];
    const productsCount = productsRes.rows[0]?.total ?? 0;
    const recent = recentRes.rows;

    // 1. Histórico del mes (Últimos 4 meses)
    let monthlyHistoryQuery = '';
    if (isSupplier) {
      monthlyHistoryQuery = `
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month_key,
               TO_CHAR(created_at, 'TMMonth') AS month_name,
               COUNT(*)::int AS orders_count,
               COALESCE(SUM(total), 0)::float AS total_amount
        FROM orders
        WHERE supplier_id = $1 AND created_at >= NOW() - INTERVAL '4 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'TMMonth')
        ORDER BY month_key DESC
      `;
    } else {
      const restParam = user.restaurant_id ? ' WHERE restaurant_id = $1' : '';
      monthlyHistoryQuery = `
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month_key,
               TO_CHAR(created_at, 'TMMonth') AS month_name,
               COUNT(*)::int AS orders_count,
               COALESCE(SUM(total), 0)::float AS total_amount
        FROM orders
        ${restParam}
        ${restParam ? ' AND ' : ' WHERE '} created_at >= NOW() - INTERVAL '4 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'TMMonth')
        ORDER BY month_key DESC
      `;
    }
    const monthlyHistoryRes = await query(
      monthlyHistoryQuery,
      isSupplier ? [user.supplier_id] : user.restaurant_id ? [user.restaurant_id] : []
    );

    // Sin datos históricos se devuelve una lista vacía (nunca cifras inventadas).
    const monthly_history = monthlyHistoryRes.rows;

    // 2. Alertas de Stock (Para Gerente / Restaurante)
    let stock_alerts: any[] = [];
    if (isRestaurant) {
      const invQuery = `
        SELECT i.id, i.name, i.category, i.unit, i.current_stock::float, i.min_stock::float, i.stock_status,
               COALESCE(s.name, 'Distribuidor Principal') AS supplier_name,
               i.supplier_id
        FROM inventory i
        LEFT JOIN suppliers s ON s.id = i.supplier_id
        ${user.restaurant_id ? 'WHERE i.restaurant_id = $1 AND (i.current_stock <= i.min_stock OR i.stock_status IN (\'critical\', \'low\'))' : 'WHERE (i.current_stock <= i.min_stock OR i.stock_status IN (\'critical\', \'low\'))'}
        ORDER BY (i.current_stock - i.min_stock) ASC
        LIMIT 6
      `;
      const invRes = await query(invQuery, user.restaurant_id ? [user.restaurant_id] : []);
      stock_alerts = invRes.rows;
    }

    // 3. Sugerencias del día (Productos recomendados para pedir hoy)
    const sugRes = await getDailySuggestions();
    const daily_suggestions = sugRes.rows;

    // 4. Descuentos del día (Promociones especiales de proveedores)
    const descRes = await getDailyDiscounts();
    const daily_discounts = descRes.rows;

    // 5. Proveedor: Info de sus productos y restaurantes clientes potenciales basados en lo que vende
    let my_products = null;
    let emerging_restaurants: any[] = [];
    let prospective_restaurants: any[] = [];

    // Obtener categoría del proveedor o restaurante
    let supplierCategory = 'Carnes';
    if (user.supplier_id) {
      const sRow = await getSupplierCategory(user.supplier_id);
      if (sRow.rowCount && sRow.rows[0].category) supplierCategory = sRow.rows[0].category;
    }

    let restaurantCategory = 'BBQ & Parrilla';
    if (user.restaurant_id) {
      const rRow = await getRestaurantCategory(user.restaurant_id);
      if (rRow.rowCount && rRow.rows[0].category) restaurantCategory = rRow.rows[0].category;
    }

    if (isSupplier || user.role === 'admin') {
      let myProdWhere = '';
      const myProdParams: unknown[] = [];
      if (user.supplier_id) {
        myProdParams.push(user.supplier_id);
        myProdWhere = ' WHERE p.supplier_id = $1';
      }
      const prodListRes = await query(
        `SELECT p.id, p.name, p.unit, p.price_per_unit::float, p.stock_available::float, p.sku, p.is_active
         FROM products p
         ${myProdWhere}
         ORDER BY p.stock_available ASC LIMIT 8`,
        myProdParams
      );

      my_products = {
        total_skus: productsCount,
        low_stock_count: prodListRes.rows.filter((p: any) => p.stock_available < 15).length,
        items: prodListRes.rows,
      };

      // Directorio de prospectos: solo datos públicos del comercio. No se
      // exponen teléfono, correo ni dirección de otros inquilinos.
      const restRes = await getRestDirectory();

      emerging_restaurants = restRes.rows;

      // Calcular prospectos potenciales basados en lo que vende el proveedor
      prospective_restaurants = emerging_restaurants.map((rest: any) => {
        let affinity = 85;
        let reasons = ['Requiere insumos regulares de despensas mayoristas'];
        const cat = (rest.category || '').toLowerCase();
        const sCat = supplierCategory.toLowerCase();

        if (sCat.includes('carne') || sCat.includes('pollo') || sCat.includes('cerdo')) {
          if (cat.includes('bbq') || cat.includes('parrilla') || cat.includes('hamburguesa') || cat.includes('latino')) {
            affinity = 98;
            reasons = ['Alto consumo diario de cortes vacunos, cerdo y embutidos', 'Pedidos semanales superiores a 80kg'];
          } else {
            affinity = 70;
            reasons = ['Uso ocasional de proteínas en recetas de carta'];
          }
        } else if (sCat.includes('lacteo') || sCat.includes('queso')) {
          if (cat.includes('postre') || cat.includes('brunch') || cat.includes('pizz') || cat.includes('cafe')) {
            affinity = 97;
            reasons = ['Alta rotación de cremas, quesos madurados y mantequillas', 'Insumo crítico diario'];
          } else {
            affinity = 75;
            reasons = ['Uso para salsas y guarniciones'];
          }
        } else if (sCat.includes('marisco') || sCat.includes('pescado')) {
          if (cat.includes('asiatico') || cat.includes('sushi') || cat.includes('marisqueria')) {
            affinity = 99;
            reasons = ['Consumo intensivo de salmón, atún, camarón y langostinos', 'Exige frescura de entrega matutina'];
          } else {
            affinity = 65;
            reasons = ['Platos especiales del fin de semana'];
          }
        } else {
          affinity = 90;
          reasons = ['Insumo transversal para cocina profesional'];
        }

        return {
          ...rest,
          affinity_score: affinity,
          match_reasons: reasons,
        };
      }).sort((a: any, b: any) => b.affinity_score - a.affinity_score);
    }

    // 6. Domiciliario: Entregas asignadas hoy
    let today_deliveries: any[] = [];
    if (isDomiciliario) {
      const delivRes = await query(
        `SELECT d.*, o.order_code, o.total, o.delivery_address, r.name AS restaurant_name, s.name AS supplier_name
         FROM deliveries d
         JOIN orders o ON o.id = d.order_id
         JOIN restaurants r ON r.id = o.restaurant_id
         JOIN suppliers s ON s.id = o.supplier_id
         WHERE d.driver_id = $1 AND d.status NOT IN ('entregado', 'fallido')
         ORDER BY d.created_at DESC`,
        [user.id]
      );
      today_deliveries = delivRes.rows;
    }

    // 7. Proveedores recomendados para el Restaurante (Banner Galería según platos y categoría)
    let recommended_suppliers: any[] = [];
    const rawSuppliers = await getRawSuppliers();

    const supRows = rawSuppliers.rows;



    recommended_suppliers = supRows.map((s: any) => {
      const meta = categoryPhotos[s.category] || {
        img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
        tag: 'Distribución Mayorista B2B',
      };
      return {
        ...s,
        image_url: meta.img,
        highlight_badge: meta.tag,
        recommended_for: `Ideal para menús de ${restaurantCategory}`,
      };
    });

    // 8. Banner tipo galería de fotos: Novedades y Comunidad


    res.json({
      orders,
      products: productsCount,
      recent,
      monthly_history,
      stock_alerts,
      daily_suggestions,
      daily_discounts,
      my_products,
      emerging_restaurants,
      prospective_restaurants,
      recommended_suppliers,
      restaurant_category: restaurantCategory,
      supplier_category: supplierCategory,
      today_deliveries,
      announcements,
    });
  } catch (err) {
    next(err);
  }
}

export async function supplierListing(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getSupplierListing();
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

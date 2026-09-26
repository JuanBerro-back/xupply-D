import { query } from '../config/db';

/**
 * Migraciones idempotentes (patrón del repo: ALTER/CREATE ... IF NOT EXISTS).
 * Se ejecutan una vez al arrancar el servidor.
 */
export async function ensureRadarAndGpsSchema(): Promise<void> {
  try {
    // ---------- GPS en tiempo real ----------
    await query(`
      -- route_history debe permitir domiciliario sin vehículo asignado
      ALTER TABLE route_history ALTER COLUMN vehicle_id DROP NOT NULL;
      ALTER TABLE route_history ADD COLUMN IF NOT EXISTS driver_id INT REFERENCES users(id);
      ALTER TABLE route_history ADD COLUMN IF NOT EXISTS heading DECIMAL(5,2);
      ALTER TABLE route_history ADD COLUMN IF NOT EXISTS accuracy DECIMAL(8,2);
      CREATE INDEX IF NOT EXISTS idx_route_driver ON route_history(driver_id, recorded_at);

      -- Validacion JWT en tiempo real
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1;

      -- Perfiles de Comercios tipo Facebook y campos nuevos de restaurantes
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS category VARCHAR(100);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50);
      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS motivo TEXT;

      -- Columnas que el código de entregas usa pero el esquema base no incluía
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(10);
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMP NULL;

      -- Última posición del domiciliario (clave por usuario, no por vehículo)
      CREATE TABLE IF NOT EXISTS driver_locations (
        driver_id   INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        delivery_id INT NULL REFERENCES deliveries(id) ON DELETE SET NULL,
        lat         DECIMAL(10,8) NOT NULL,
        lng         DECIMAL(11,8) NOT NULL,
        speed       DECIMAL(6,2),
        heading     DECIMAL(5,2),
        accuracy    DECIMAL(8,2),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- ---------- Radar de Stock ----------
      CREATE TABLE IF NOT EXISTS radar_shares (
        id SERIAL PRIMARY KEY,
        restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        supplier_id   INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        scope         VARCHAR(20) DEFAULT 'todo',
        category      VARCHAR(100) NULL,
        inventory_id  INT NULL REFERENCES inventory(id) ON DELETE CASCADE,
        share_level   VARCHAR(20) DEFAULT 'semaforo',
        alert_on      VARCHAR(20) DEFAULT 'critical',
        is_active     BOOLEAN DEFAULT TRUE,
        created_by    INT REFERENCES users(id),
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_radar_shares
        ON radar_shares(restaurant_id, supplier_id, scope, COALESCE(category,''), COALESCE(inventory_id,0));
      CREATE INDEX IF NOT EXISTS idx_radar_shares_supplier ON radar_shares(supplier_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_radar_shares_restaurant ON radar_shares(restaurant_id, is_active);

      CREATE TABLE IF NOT EXISTS radar_alerts (
        id SERIAL PRIMARY KEY,
        restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        supplier_id   INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        inventory_id  INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
        level         VARCHAR(20) NOT NULL,
        unit          VARCHAR(30),
        suggested_qty DECIMAL(10,2),
        status        VARCHAR(20) DEFAULT 'abierta',
        opened_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at    TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '24 hours')
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_radar_alert_open
        ON radar_alerts(restaurant_id, supplier_id, inventory_id) WHERE status = 'abierta';
      CREATE INDEX IF NOT EXISTS idx_radar_alerts_supplier ON radar_alerts(supplier_id, status);

      CREATE TABLE IF NOT EXISTS radar_offers (
        id SERIAL PRIMARY KEY,
        alert_id      INT NOT NULL REFERENCES radar_alerts(id) ON DELETE CASCADE,
        supplier_id   INT NOT NULL REFERENCES suppliers(id),
        product_name  VARCHAR(200) NOT NULL,
        unit          VARCHAR(30),
        offered_qty   DECIMAL(10,2) NOT NULL,
        offered_price DECIMAL(12,2) NOT NULL,
        eta_hours     INT DEFAULT 24,
        notes         TEXT,
        status        VARCHAR(20) DEFAULT 'pendiente',
        order_id      INT NULL REFERENCES orders(id) ON DELETE SET NULL,
        created_by    INT REFERENCES users(id),
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until   TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '12 hours')
      );
      CREATE INDEX IF NOT EXISTS idx_radar_offers_status ON radar_offers(status, valid_until);
      CREATE INDEX IF NOT EXISTS idx_radar_offers_alert ON radar_offers(alert_id);
      -- Permiso Analytics
      INSERT INTO permissions (name, description)
      VALUES ('analytics', 'Ver analitica y KPIs de la plataforma')
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'admin' AND p.name = 'analytics'
      ON CONFLICT DO NOTHING;

    `);
    console.log('[DB] Esquema Radar de Stock + GPS verificado.');
    
    // Indice unico parcial contabilidad
    try {
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_invoice_ingreso
        ON accounting_transactions (reference_type, reference_id, type)
        WHERE reference_type = 'invoice';
      `);
    } catch (e) {
      console.warn('[DB] Advertencia creando índice uq_accounting_invoice_ingreso:', e);
    }
  } catch (err) {
    console.error('[DB] Error aplicando esquema Radar/GPS:', err);
  }
}

/** Cierra alertas y ofertas vencidas. Se ejecuta cada hora. */
export async function expireRadarItems(): Promise<void> {
  try {
    await query(
      `UPDATE radar_alerts SET status = 'expirada'
        WHERE status IN ('abierta', 'ofertada') AND expires_at < CURRENT_TIMESTAMP`
    );
    await query(
      `UPDATE radar_offers SET status = 'expirada'
        WHERE status = 'pendiente' AND valid_until < CURRENT_TIMESTAMP`
    );
  } catch (err) {
    console.error('[Radar] Error expirando alertas/ofertas:', err);
  }
}

export async function dropLegacyPlatformViews(): Promise<void> {
  try {
    await query(`
      DROP VIEW IF EXISTS v_platform_kpis;
      DROP VIEW IF EXISTS v_sales_by_day;
      DROP VIEW IF EXISTS v_orders_by_status;
      DROP VIEW IF EXISTS v_top_products;
      DROP VIEW IF EXISTS v_top_suppliers;
    `);
    console.log('[DB] Vistas de KPIs (Legacy) borradas sin CASCADE.');
  } catch (err) {
    console.error('[DB] Error borrando vistas de KPIs:', err);
  }
}

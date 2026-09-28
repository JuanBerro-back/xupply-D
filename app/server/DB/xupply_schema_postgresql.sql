-- ============================================================
-- XUPPLY IA - Esquema de Base de Datos PostgreSQL
-- Plataforma B2B ERP / Ecosistema Logístico con IA
-- Surtesoft - v2.0
-- ============================================================

-- ------------------------------------------------------------
-- TIPOS ENUM personalizados
-- ------------------------------------------------------------
CREATE TYPE order_status AS ENUM ('nuevo', 'confirmado', 'preparando', 'despachado', 'en_camino', 'entregado', 'cancelado');
CREATE TYPE invoice_mode AS ENUM ('electronica', 'pos', 'comandas');
CREATE TYPE invoice_id_type AS ENUM ('nit', 'cedula', 'email', 'Pasaporte');
CREATE TYPE payment_method AS ENUM ('Efectivo', 'Tarjeta', 'Nequi', 'PSE', 'Daviplata', 'Credito');
CREATE TYPE invoice_status AS ENUM ('borrador', 'emitida', 'pagada', 'anulada');
CREATE TYPE inventory_stock_status AS ENUM ('critical', 'low', 'normal');
CREATE TYPE accounting_type AS ENUM ('ingreso', 'egreso');
CREATE TYPE vehicle_type AS ENUM ('moto', 'furgon', 'camion', 'camioneta');
CREATE TYPE vehicle_status AS ENUM ('disponible', 'en_ruta', 'cargando', 'mantenimiento');
CREATE TYPE delivery_status AS ENUM ('asignado', 'en_camino', 'llegando', 'entregado', 'fallido');
CREATE TYPE inventory_movement_type AS ENUM ('entrada', 'salida', 'ajuste', 'merma');

-- ------------------------------------------------------------
-- TABLA: roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: permissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: role_permissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ------------------------------------------------------------
-- TABLA: restaurants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  nit VARCHAR(20) UNIQUE,
  phone VARCHAR(20),
  email VARCHAR(200),
  address VARCHAR(500),
  city VARCHAR(100) DEFAULT 'Bucaramanga',
  department VARCHAR(100) DEFAULT 'Santander',
  logo_url VARCHAR(500),
  category VARCHAR(100),
  subscription_plan VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: branches
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(500),
  phone VARCHAR(20),
  is_main BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  phone VARCHAR(20),
  role_id INT NOT NULL REFERENCES roles(id),
  restaurant_id INT REFERENCES restaurants(id) ON DELETE SET NULL,
  branch_id INT REFERENCES branches(id) ON DELETE SET NULL,
  supplier_id INT,
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: suppliers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  nit VARCHAR(20) UNIQUE,
  category VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(200),
  address VARCHAR(500),
  city VARCHAR(100) DEFAULT 'Bucaramanga',
  logo_url VARCHAR(500),
  rating DECIMAL(2,1) DEFAULT 0.0,
  review_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FK de users hacia suppliers
ALTER TABLE users ADD CONSTRAINT fk_users_supplier
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- TABLA: product_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id INT REFERENCES product_categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  sku VARCHAR(50),
  unit VARCHAR(30) NOT NULL DEFAULT 'kg',
  price_per_unit DECIMAL(12,2) NOT NULL,
  min_order_qty DECIMAL(10,2) DEFAULT 1,
  stock_available DECIMAL(10,2) DEFAULT 0,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: inventory
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id INT REFERENCES branches(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(30) NOT NULL DEFAULT 'kg',
  current_stock DECIMAL(10,2) DEFAULT 0,
  min_stock DECIMAL(10,2) DEFAULT 0,
  max_stock DECIMAL(10,2) DEFAULT 0,
  avg_daily_usage DECIMAL(10,2) DEFAULT 0,
  cost_per_unit DECIMAL(12,2) DEFAULT 0,
  batch_date DATE,
  expiry_date DATE,
  stock_status inventory_stock_status DEFAULT 'normal',
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_restaurant ON inventory(restaurant_id);
CREATE INDEX idx_inventory_stock_status ON inventory(stock_status);
CREATE INDEX idx_inventory_expiry ON inventory(expiry_date);

-- ------------------------------------------------------------
-- TABLA: menu_products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_products (
  id SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(12,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: recipes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  menu_product_id INT NOT NULL REFERENCES menu_products(id) ON DELETE CASCADE,
  inventory_id INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  quantity DECIMAL(10,4) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  cost_per_unit DECIMAL(12,2) DEFAULT 0,
  waste_pct DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_code VARCHAR(20) NOT NULL UNIQUE,
  restaurant_id INT NOT NULL REFERENCES restaurants(id),
  branch_id INT REFERENCES branches(id) ON DELETE SET NULL,
  supplier_id INT NOT NULL REFERENCES suppliers(id),
  status order_status DEFAULT 'nuevo',
  total DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  delivery_address VARCHAR(500),
  requested_delivery_date TIMESTAMP,
  confirmed_at TIMESTAMP NULL,
  dispatched_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_supplier ON orders(supplier_id);
CREATE INDEX idx_orders_created ON orders(created_at);

-- ------------------------------------------------------------
-- TABLA: order_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  inventory_id INT REFERENCES inventory(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  unit_price DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: invoices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_code VARCHAR(30) NOT NULL UNIQUE,
  cufe VARCHAR(100),
  mode invoice_mode DEFAULT 'electronica',
  restaurant_id INT NOT NULL REFERENCES restaurants(id),
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  client_name VARCHAR(200),
  client_id_number VARCHAR(30),
  client_id_type invoice_id_type DEFAULT 'cedula',
  client_email VARCHAR(200),
  client_address VARCHAR(500),
  subtotal DECIMAL(12,2) DEFAULT 0,
  iva_rate DECIMAL(5,2) DEFAULT 19.00,
  iva_amount DECIMAL(12,2) DEFAULT 0,
  impoconsumo_rate DECIMAL(5,2) DEFAULT 8.00,
  impoconsumo_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  payment_method payment_method DEFAULT 'Efectivo',
  status invoice_status DEFAULT 'borrador',
  motivo TEXT,
  mesa VARCHAR(10),
  mesero VARCHAR(100),
  issued_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_restaurant ON invoices(restaurant_id);
CREATE INDEX idx_invoices_date ON invoices(issued_at);

-- ------------------------------------------------------------
-- TABLA: invoice_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(300) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: supplier_reviews
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Reseña (
  id SERIAL PRIMARY KEY,
  supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  reviewer_name VARCHAR(200),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: accounting_transactions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_transactions (
  id SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL REFERENCES restaurants(id),
  type accounting_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(500),
  category VARCHAR(100),
  reference_type VARCHAR(50),
  reference_id INT,
  payment_method VARCHAR(50),
  transaction_date DATE NOT NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounting_restaurant ON accounting_transactions(restaurant_id);
CREATE INDEX idx_accounting_date ON accounting_transactions(transaction_date);
CREATE INDEX idx_accounting_type ON accounting_transactions(type);

-- ------------------------------------------------------------
-- TABLA: vehicles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  plate VARCHAR(20) NOT NULL,
  type vehicle_type DEFAULT 'moto',
  driver_name VARCHAR(200),
  status vehicle_status DEFAULT 'disponible',
  current_lat DECIMAL(10,8) NULL,
  current_lng DECIMAL(11,8) NULL,
  last_location_update TIMESTAMP NULL,
  imei VARCHAR(20) NULL,
  gps_validated BOOLEAN DEFAULT FALSE,
  gps_last_seen TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS imei VARCHAR(20) NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_validated BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_last_seen TIMESTAMP NULL;

-- ------------------------------------------------------------
-- TABLA: deliveries
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  delivery_code VARCHAR(30) NOT NULL UNIQUE,
  order_id INT NOT NULL REFERENCES orders(id),
  vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id INT REFERENCES users(id) ON DELETE SET NULL,
  restaurant_id INT NOT NULL REFERENCES restaurants(id),
  delivery_address VARCHAR(500),
  dest_lat DECIMAL(10,8) NULL,
  dest_lng DECIMAL(11,8) NULL,
  status delivery_status DEFAULT 'asignado',
  scheduled_time TIMESTAMP,
  actual_delivery_time TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);

-- ------------------------------------------------------------
-- TABLA: delivery_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_items (
  id SERIAL PRIMARY KEY,
  delivery_id INT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_name VARCHAR(200) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TABLA: route_history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_history (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  delivery_id INT REFERENCES deliveries(id) ON DELETE SET NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  speed DECIMAL(6,2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_route_vehicle ON route_history(vehicle_id, recorded_at);

-- ------------------------------------------------------------
-- TABLA: inventory_movements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  inventory_id INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  type inventory_movement_type NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  previous_stock DECIMAL(10,2),
  new_stock DECIMAL(10,2),
  reference_type VARCHAR(50),
  reference_id INT,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inv_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX idx_inv_movements_date ON inventory_movements(created_at);

-- ------------------------------------------------------------
-- TABLA: audit_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- ------------------------------------------------------------
-- FUNCION: Auto-actualizar updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_products_updated_at BEFORE UPDATE ON menu_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Roles
INSERT INTO roles (name, display_name, description) VALUES
('admin', 'Administrador', 'Acceso total al sistema: configuracion, metricas, usuarios'),
('gerente', 'Gerente', 'Gestion de pedidos, reportes y facturacion'),
('empleado', 'Empleado', 'Acceso operativo a inventario y comandas'),
('proveedor_admin', 'Proveedor Admin', 'Catalogo digital, recepcion de pedidos y despachos'),
('domiciliario', 'Domiciliario', 'Rutas asignadas, entregas y GPS');

-- Permisos
INSERT INTO permissions (name, description) VALUES
('dashboard', 'Ver dashboard ejecutivo'),
('analytics', 'Ver analitica y KPIs de la plataforma'),
('pedidos', 'Ver pedidos'),
('pedidos:write', 'Crear/editar pedidos'),
('inventario', 'Ver inventario'),
('inventario:write', 'Crear/editar inventario'),
('contabilidad', 'Ver contabilidad'),
('contabilidad:write', 'Crear/editar movimientos contables'),
('proveedores', 'Ver proveedores'),
('proveedores:write', 'Gestionar proveedores'),
('costeo', 'Ver costeo de platos'),
('costeo:write', 'Crear/editar costeo'),
('facturacion', 'Ver facturacion'),
('facturacion:write', 'Emitir facturas'),
('config', 'Configuracion del sistema'),
('prov:dashboard', 'Dashboard del proveedor'),
('prov:logistica', 'Logistica del proveedor'),
('prov:gps', 'GPS del proveedor'),
('prov:inventario', 'Ver inventario del proveedor'),
('prov:inventario:write', 'Gestionar inventario del proveedor'),
('prov:precios', 'Gestionar precios del proveedor');

-- Relacion roles-permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name IN (
  'dashboard', 'pedidos', 'pedidos:write', 'inventario', 'contabilidad',
  'proveedores', 'costeo', 'facturacion'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN ('inventario', 'costeo');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE name LIKE 'prov:%';

INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions WHERE name IN ('prov:logistica', 'prov:gps');

-- Restaurantes
INSERT INTO restaurants (name, nit, phone, email, address, city) VALUES
('Rancho Grande BGA', '900123456-7', '(607) 634-5678', 'info@ranchogrande.com', 'Cra 27 #45-32, Cabecera', 'Bucaramanga'),
('Fogon Santandereano', '900765432-1', '(607) 634-1234', 'contacto@fogonsantandereano.com', 'Calle 35 #22-10, San Pio', 'Bucaramanga'),
('La Castellana Grill', '900987654-3', '(607) 634-5679', 'admin@lacastellana.com', 'Cra 15 #48-20, Centro', 'Bucaramanga'),
('Fritangueria Bonita', '900345678-9', '(607) 634-9876', 'ventas@fritangueria.com', 'Calle 50 #12-45, Cordoba', 'Bucaramanga'),
('El Corral BGA', '900567890-1', '(607) 634-4321', 'info@elcorralbga.com', 'Cra 30 #55-18, Cabecera', 'Bucaramanga');

-- Sucursales
INSERT INTO branches (restaurant_id, name, address, is_main) VALUES
(1, 'Sede Principal', 'Cra 27 #45-32, Cabecera', TRUE),
(2, 'Sede San Pio', 'Calle 35 #22-10, San Pio', TRUE),
(3, 'Sede Centro', 'Cra 15 #48-20, Centro', TRUE),
(4, 'Sede Cordoba', 'Calle 50 #12-45, Cordoba', TRUE),
(5, 'Sede Cabecera', 'Cra 30 #55-18, Cabecera', TRUE);

-- Proveedores
INSERT INTO suppliers (name, nit, category, phone, email, address, city, rating, review_count) VALUES
('Carnes El Paisa S.A.S', '900111222-3', 'Carnes', '(607) 634-1111', 'ventas@carneelpaisa.com', 'Via 40 #15-20, Zona Industrial', 'Bucaramanga', 4.7, 45),
('Lacteos del Norte', '900333444-5', 'Lacteos', '(607) 634-2222', 'pedidos@lacteosnorte.com', 'Cra 8 #20-30, La Cordova', 'Bucaramanga', 4.5, 32),
('Mariscos del Caribe', '900555666-7', 'Mariscos', '(607) 634-3333', 'ventas@mariscoscaribe.com', 'Calle 25 #10-15, San Francisco', 'Bucaramanga', 4.8, 28),
('Verduras Frescas SAS', '900777888-9', 'Verduras', '(607) 634-4444', 'pedidos@verdurasfrescas.com', 'Via 40 #25-40, Zona Industrial', 'Bucaramanga', 4.3, 19),
('Distribuidora de Bebidas', '900999000-1', 'Bebidas', '(607) 634-5555', 'ventas@distbebidass.com', 'Cra 12 #30-50, Centro', 'Bucaramanga', 4.6, 37);

-- Categorias
INSERT INTO product_categories (name, icon, sort_order) VALUES
('Carnes', '🥩', 1),
('Pollo', '🍗', 2),
('Cerdo', '🐷', 3),
('Mariscos', '🦐', 4),
('Lacteos', '🧀', 5),
('Verduras', '🥬', 6),
('Frutas', '🍎', 7),
('Bebidas', '🥤', 8),
('Granos', '🫘', 9),
('Condimentos', '🧂', 10);

-- Productos catalogo B2B
INSERT INTO products (supplier_id, category_id, name, unit, price_per_unit, stock_available) VALUES
(1, 1, 'Carne de res 90/10', 'kg', 29000, 500),
(1, 1, 'Carne molida', 'kg', 22000, 300),
(1, 1, 'Costilla de res', 'kg', 18000, 200),
(1, 1, 'Lomo de res', 'kg', 37000, 100),
(1, 2, 'Pechuga de pollo', 'kg', 11000, 400),
(1, 2, 'Muslo de pollo', 'kg', 8500, 250),
(1, 3, 'Chicharron', 'kg', 15000, 150),
(1, 3, 'Costilla cerdo ahumada', 'kg', 18000, 100),
(3, 4, 'Camaron tigre pelado', 'kg', 45000, 50),
(2, 5, 'Queso costeño x kg', 'kg', 14000, 80),
(2, 5, 'Mantequilla', 'kg', 12000, 120),
(4, 6, 'Cebolla cabezona', 'kg', 4500, 200),
(4, 6, 'Tomate', 'kg', 5000, 180),
(4, 6, 'Pimenton', 'kg', 7000, 100),
(5, 8, 'Agua 500ml', 'unidad', 1500, 1000),
(5, 8, 'Gaseosa 350ml', 'unidad', 2500, 800),
(5, 8, 'Jugo natural', 'litro', 4000, 200);

-- Inventario demo
INSERT INTO inventory (restaurant_id, branch_id, name, category, unit, current_stock, min_stock, max_stock, avg_daily_usage, cost_per_unit, batch_date, expiry_date, stock_status, supplier_id) VALUES
(1, 1, 'Carne de res 90/10', 'Res', 'kg', 180, 50, 300, 25, 29000, '2026-08-10', '2026-08-25', 'normal', 1),
(1, 1, 'Carne molida', 'Res', 'kg', 95, 30, 200, 15, 22000, '2026-08-12', '2026-08-27', 'normal', 1),
(1, 1, 'Costilla de res', 'Res', 'kg', 60, 20, 150, 10, 18000, '2026-08-11', '2026-08-26', 'normal', 1),
(1, 1, 'Lomo de res', 'Res', 'kg', 40, 15, 100, 6, 37000, '2026-08-10', '2026-08-24', 'low', 1),
(1, 1, 'Pechuga de pollo', 'Pollo', 'kg', 120, 40, 250, 18, 11000, '2026-08-13', '2026-08-28', 'normal', 1),
(1, 1, 'Muslo de pollo', 'Pollo', 'kg', 85, 30, 200, 12, 8500, '2026-08-12', '2026-08-27', 'normal', 1),
(1, 1, 'Chicharron', 'Cerdo', 'kg', 50, 20, 100, 8, 15000, '2026-08-09', '2026-08-23', 'low', 1),
(1, 1, 'Costilla cerdo ahumada', 'Cerdo', 'kg', 35, 15, 80, 5, 18000, '2026-08-11', '2026-08-25', 'low', 1),
(1, 1, 'Camaron tigre pelado', 'Mariscos', 'kg', 20, 10, 50, 3, 45000, '2026-08-14', '2026-08-21', 'low', 3),
(1, 1, 'Queso costeño x kg', 'Lacteos', 'kg', 45, 15, 100, 7, 14000, '2026-08-13', '2026-08-30', 'normal', 2);

-- Menu demo
INSERT INTO menu_products (restaurant_id, name, category, price) VALUES
(1, 'Mute Santandereano', 'Fuertes', 22000),
(1, 'Hamburguesa Especial', 'Fuertes', 18000),
(1, 'Bandeja Paisa', 'Fuertes', 28000),
(1, 'Arepa con Huevo', 'Entradas', 8000),
(1, 'Caldo de Costilla', 'Entradas', 16000),
(1, 'Sancocho de Gallina', 'Fuertes', 24000),
(1, 'Agua 500ml', 'Bebidas', 3000),
(1, 'Jugo Natural', 'Bebidas', 7000),
(1, 'Gaseosa 350ml', 'Bebidas', 4000),
(1, 'Cafe Americano', 'Bebidas', 5000);

-- Usuarios demo
INSERT INTO users (username, password_hash, name, email, role_id, restaurant_id, branch_id) VALUES
('admin', '$2b$10$DefaulthashForDemo123456789012345678901234567890', 'Super Administrador', 'admin@xupply.com', 1, NULL, NULL),
('gerente', '$2b$10$DefaulthashForDemo123456789012345678901234567890', 'Laura Vargas', 'gerente@ranchogrande.com', 2, 1, 1),
('empleado', '$2b$10$DefaulthashForDemo123456789012345678901234567890', 'Miguel Torres', 'empleado@ranchogrande.com', 3, 1, 1),
('proveedor', '$2b$10$DefaulthashForDemo123456789012345678901234567890', 'Pedro Mora', 'pedro@carneelpaisa.com', 4, NULL, NULL),
('domiciliario', '$2b$10$DefaulthashForDemo123456789012345678901234567890', 'Jhon Diaz', 'jhon@carneelpaisa.com', 5, NULL, NULL);

-- ============================================================
-- VISTAS
-- ============================================================

CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  r.id AS restaurant_id,
  r.name AS restaurant_name,
  (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id AND o.status != 'cancelado') AS total_orders,
  (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id AND DATE(o.created_at) = CURRENT_DATE) AS today_orders,
  (SELECT COALESCE(SUM(i.total), 0) FROM invoices i WHERE i.restaurant_id = r.id AND DATE(i.issued_at) = CURRENT_DATE) AS today_revenue,
  (SELECT COUNT(*) FROM inventory inv WHERE inv.restaurant_id = r.id AND inv.stock_status = 'critical') AS critical_stock_count,
  (SELECT COUNT(*) FROM suppliers s WHERE s.is_active = TRUE) AS active_suppliers
FROM restaurants r;

CREATE OR REPLACE VIEW v_inventory_predictions AS
SELECT
  i.id,
  i.name AS item_name,
  i.restaurant_id,
  i.current_stock,
  i.min_stock,
  i.avg_daily_usage,
  i.unit,
  i.expiry_date,
  CASE
    WHEN i.current_stock <= i.min_stock THEN 'high'
    WHEN i.current_stock <= i.min_stock * 1.5 THEN 'medium'
    ELSE 'low'
  END AS urgency,
  ROUND(i.avg_daily_usage * 7, 2) AS recommended_order_qty,
  CASE
    WHEN i.avg_daily_usage > 20 THEN 'increasing'
    WHEN i.avg_daily_usage < 5 THEN 'decreasing'
    ELSE 'stable'
  END AS trend
FROM inventory i
WHERE i.is_active = TRUE;

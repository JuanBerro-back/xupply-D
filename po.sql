DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='purchase_order_status') THEN
    CREATE TYPE purchase_order_status AS ENUM ('borrador','enviada','confirmada','cancelada');
  END IF;
END$$;
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  order_code VARCHAR(30) NOT NULL UNIQUE,
  restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status purchase_order_status NOT NULL DEFAULT 'borrador',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_po_restaurant ON purchase_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_po_item_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_item_product ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
INSERT INTO permissions (name,description) VALUES ('compras:write','Crear y gestionar ordenes de compra') ON CONFLICT (name) DO NOTHING;

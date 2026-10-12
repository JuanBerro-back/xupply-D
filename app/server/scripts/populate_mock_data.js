const { Client } = require('pg');

const client = new Client({ connectionString: 'postgres://postgres@127.0.0.1:5433/xupply' });

async function run() {
  await client.connect();
  console.log("Connected to DB");

  // Get Role IDs
  const rolesRes = await client.query("SELECT id, name FROM roles");
  const roles = rolesRes.rows.reduce((acc, row) => ({ ...acc, [row.name]: row.id }), {});

  if(!roles['proveedor_admin'] || !roles['gerente']) {
    console.error("Roles not found in DB!");
    process.exit(1);
  }

  // 1. Insert Suppliers into `suppliers` table
  const suppliers = [
    { name: 'Distribuidora Carnes Premium', category: 'Carnes', email: 'carnes@test.com' },
    { name: 'Lácteos El Campo', category: 'Lácteos', email: 'lacteos@test.com' },
    { name: 'Empaques Biodegradables SA', category: 'Empaques', email: 'empaques@test.com' }
  ];

  for (const s of suppliers) {
    await client.query(`
      INSERT INTO suppliers (name, category, email, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT DO NOTHING
    `, [s.name, s.category, s.email]);
  }

  const resProv = await client.query("SELECT id, name FROM suppliers");
  const provIds = resProv.rows.reduce((acc, row) => ({ ...acc, [row.name]: row.id }), {});

  // 2. Create Users for Suppliers
  const supUsers = [
    { username: 'prov_carnes', email: 'carnes@test.com', supplier_id: provIds['Distribuidora Carnes Premium'] },
    { username: 'prov_lacteos', email: 'lacteos@test.com', supplier_id: provIds['Lácteos El Campo'] },
    { username: 'prov_empaques', email: 'empaques@test.com', supplier_id: provIds['Empaques Biodegradables SA'] }
  ];

  for (const u of supUsers) {
    await client.query(`
      INSERT INTO users (username, password_hash, name, email, role_id, supplier_id, is_active)
      VALUES ($1, '123456', $1, $2, $3, $4, true)
      ON CONFLICT (username) DO NOTHING
    `, [u.username, u.email, roles['proveedor_admin'], u.supplier_id]);
  }

  // 3. Insert Restaurants
  const rests = [
    { name: 'Burger Master', type: 'Restaurante', address: 'Calle 50 #20-10' },
    { name: 'Sushi Zen', type: 'Restaurante', address: 'Cra 33 #45-12' },
    { name: 'Pizzería Napoli', type: 'Restaurante', address: 'Calle 10 #10-10' },
    { name: 'Café del Parque', type: 'Cafetería', address: 'Cra 27 #36-14' }
  ];

  for (const r of rests) {
    await client.query(`
      INSERT INTO restaurants (name, category, address, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT DO NOTHING
    `, [r.name, r.type, r.address]);
  }

  const resRest = await client.query("SELECT id, name FROM restaurants");
  const restIds = resRest.rows.reduce((acc, row) => ({ ...acc, [row.name]: row.id }), {});

  // 4. Create Users for Restaurants
  for (const r of rests) {
    const username = r.name.toLowerCase().replace(/ /g, '_');
    await client.query(`
      INSERT INTO users (username, password_hash, name, email, role_id, restaurant_id, is_active)
      VALUES ($1, '123456', $2, $3, $4, $5, true)
      ON CONFLICT (username) DO NOTHING
    `, [username, r.name, `${username}@test.com`, roles['gerente'], restIds[r.name]]);
  }

  // 5. Skipped supplier_clients as no such table exists

  // 6. Products
  const products = [
    { name: 'Corte Ribeye Angus', description: 'Corte de res Premium de 300g', price: 45000, supplier_id: provIds['Distribuidora Carnes Premium'], category: 'Carnes', unit: 'kg' },
    { name: 'Lomo de Cerdo', description: 'Lomo fino 1kg', price: 25000, supplier_id: provIds['Distribuidora Carnes Premium'], category: 'Carnes', unit: 'kg' },
    { name: 'Queso Mozzarella', description: 'Bloque 2kg', price: 38000, supplier_id: provIds['Lácteos El Campo'], category: 'Lácteos', unit: 'bloque' },
    { name: 'Leche Entera', description: 'Caja x 12 Litros', price: 42000, supplier_id: provIds['Lácteos El Campo'], category: 'Lácteos', unit: 'caja' },
    { name: 'Cajas para Hamburguesa', description: 'Paquete x 100 Kraft', price: 15000, supplier_id: provIds['Empaques Biodegradables SA'], category: 'Empaques', unit: 'paquete' },
    { name: 'Vasos 16oz', description: 'Paquete x 50 Transparentes', price: 8000, supplier_id: provIds['Empaques Biodegradables SA'], category: 'Empaques', unit: 'paquete' }
  ];

  for (const p of products) {
    if(!p.supplier_id) continue;
    await client.query(`
      INSERT INTO products (name, description, price_per_unit, unit, stock_available, supplier_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT DO NOTHING
    `, [p.name, p.description, p.price, p.unit, 500, p.supplier_id]);
  }

  // 7. Inventory
  for (const r of resRest.rows) {
    const items = [
      { name: 'Sal', quantity: 50, unit: 'kg', min_stock: 10, status: 'normal' },
      { name: 'Pimienta', quantity: 5, unit: 'kg', min_stock: 2, status: 'normal' },
      { name: 'Aceite', quantity: 2, unit: 'galones', min_stock: 5, status: 'critical' },
      { name: 'Harina', quantity: 15, unit: 'kg', min_stock: 20, status: 'low' }
    ];
    for (const i of items) {
      await client.query(`
        INSERT INTO inventory (restaurant_id, name, current_stock, unit, min_stock, stock_status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [r.id, i.name, i.quantity, i.unit, i.min_stock, i.status]);
    }
  }

  console.log("Database successfully populated with Ecosystem Data!");
  await client.end();
}

run().catch(console.error);

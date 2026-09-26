import { pool } from '../src/config/db';
import { createApp } from '../src/app';
import http from 'http';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: No DATABASE_URL set. No se correrá el smoke test por seguridad.');
    process.exit(1);
  }

  const dbUrl = new URL(process.env.DATABASE_URL);
  const dbName = dbUrl.pathname.replace('/', '');
  const dbHost = dbUrl.host;
  
  console.log(`\n=== INICIANDO SMOKE TEST ===`);
  console.log(`Host: ${dbHost} | Base de datos: ${dbName}`);
  
  if (dbName.toLowerCase().includes('prod')) {
    console.warn('\n⚠️  ATENCIÓN: El nombre de la base de datos contiene "prod". Ejecución abortada por seguridad.');
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);
  
  // listen on ephemeral port
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;

  const roles = ['admin', 'gerente', 'empleado', 'proveedor_admin', 'domiciliario'];
  const pwd = process.env.SMOKE_PASSWORD || 'demo1234';
  
  const tokens: Record<string, string> = {};
  
  // LOGIN
  for (const roleName of roles) {
    const res = await pool.query(`SELECT u.username FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = $1 LIMIT 1`, [roleName]);
    if (!res.rowCount) {
      console.error(`ERROR: No se encontró usuario para el rol ${roleName}`);
      process.exit(1);
    }
    const username = res.rows[0].username;
    
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pwd })
    });
    
    if (!loginRes.ok) {
      console.error(`ERROR: Fallo login para ${username} (${roleName}). HTTP ${loginRes.status}`);
      process.exit(1);
    }
    
    const data = await loginRes.json() as any;
    tokens[roleName] = data.token;
  }
  
  const endpoints = ['/api/admin/stats', '/api/admin/restaurants', '/api/admin/audit-log', '/api/users'];
  const results: any[] = [];
  let hasError = false;

  // MATRIZ PERMISOS
  for (const roleName of roles) {
    const token = tokens[roleName];
    const row: any = { Rol: roleName };
    
    for (const ep of endpoints) {
      const epRes = await fetch(`${baseUrl}${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = epRes.status;
      row[ep] = status;
      
      if (roleName === 'admin' && status !== 200) {
        console.error(`ERROR: admin en ${ep} esperaba 200, obtuvo ${status}`);
        hasError = true;
      }
      if (roleName !== 'admin' && status !== 403) {
        console.error(`ERROR: ${roleName} en ${ep} esperaba 403, obtuvo ${status}`);
        hasError = true;
      }
    }
    results.push(row);
  }
  
  console.log('\n--- MATRIZ DE ACCESO (SMOKE TEST) ---');
  console.table(results);
  
  if (hasError) {
    process.exit(1);
  }

  // PRUEBAS ESCRITURA ADMIN (solo en base de pruebas)
  const adminToken = tokens['admin'];
  console.log('\n--- PROBANDO ESCRITURA ADMIN ---');
  
  // POST /admin/restaurants
  const createRestRes = await fetch(`${baseUrl}/api/admin/restaurants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Smoke Rest ${Date.now()}`,
      nit: `900-${Date.now()}`,
      category: 'SmokeCategory',
      subscription_plan: 'SmokePlan'
    })
  });
  if (!createRestRes.ok) {
    console.error(`ERROR POST /admin/restaurants: ${createRestRes.status}`);
    console.error(await createRestRes.text());
    process.exit(1);
  }
  const createdRest = await createRestRes.json() as any;
  const restId = createdRest.id;
  
  // POST /admin/branches
  const createBranchRes = await fetch(`${baseUrl}/api/admin/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      restaurant_id: restId,
      name: 'Smoke Branch',
      is_main: true
    })
  });
  if (!createBranchRes.ok) {
    console.error(`ERROR POST /admin/branches: ${createBranchRes.status}`);
    process.exit(1);
  }
  const createdBranch = await createBranchRes.json() as any;
  const branchId = createdBranch.id;
  
  // PATCH deactivate branch
  const deactBranchRes = await fetch(`${baseUrl}/api/admin/branches/${branchId}/deactivate`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (!deactBranchRes.ok) {
    console.error(`ERROR PATCH deactivate branch: ${deactBranchRes.status}`);
    process.exit(1);
  }
  
  // PATCH activate branch
  const actBranchRes = await fetch(`${baseUrl}/api/admin/branches/${branchId}/activate`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (!actBranchRes.ok) {
    console.error(`ERROR PATCH activate branch: ${actBranchRes.status}`);
    process.exit(1);
  }
  
  // Cleanup test data safely
  await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
  await pool.query('DELETE FROM restaurants WHERE id = $1', [restId]);
  console.log('✅ Pruebas de escritura Admin OK.');

  // PRUEBAS DE FACTURAS
  if (process.env.SMOKE_ALLOW_INVOICES === '1') {
    console.log('\n--- PROBANDO FACTURAS Y REVERSIÓN CONTABLE ---');
    const invCode = `SMK-${Date.now()}`;
    const total = 10000;
    
    const restRes = await pool.query('INSERT INTO restaurants (name) VALUES ($1) RETURNING id', ['Smoke Rest Invoice']);
    const myRestId = restRes.rows[0].id;
    const invRes = await pool.query(
      `INSERT INTO invoices (invoice_code, restaurant_id, status, total) VALUES ($1, $2, 'borrador', $3) RETURNING id`, 
      [invCode, myRestId, total]
    );
    const invId = invRes.rows[0].id;
    
    const otherRestRes = await pool.query('INSERT INTO restaurants (name) VALUES ($1) RETURNING id', ['Smoke Other Rest']);
    const otherRestId = otherRestRes.rows[0].id;
    const otherInvRes = await pool.query(
      `INSERT INTO invoices (invoice_code, restaurant_id, status, total) VALUES ($1, $2, 'borrador', 5000) RETURNING id`, 
      [`SMK2-${Date.now()}`, otherRestId]
    );
    const otherInvId = otherInvRes.rows[0].id;
    
    const gerenteToken = tokens['gerente'];
    const adminToken = tokens['admin'];
    
    // admin puede modificar cualquier factura sin restricción de tenant
    const patchStatus = async (id: number, status: string, motivo?: string, token: string = adminToken) => {
      const body: any = { status };
      if (motivo) body.motivo = motivo;
      return await fetch(`${baseUrl}/api/invoices/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
    };
    
    // ajeno -> 403 (usando token de gerente de otra sucursal)
    const resAjeno = await patchStatus(otherInvId, 'emitida', undefined, gerenteToken);
    if (resAjeno.status !== 403) {
      console.error(`ERROR: Factura ajena esperaba 403, obtuvo ${resAjeno.status}`);
      process.exit(1);
    }
    
    // borrador -> pagada (400)
    const resBP = await patchStatus(invId, 'pagada');
    if (resBP.status !== 400) {
      console.error(`ERROR: borrador->pagada esperaba 400, obtuvo ${resBP.status}`);
      process.exit(1);
    }
    
    // borrador -> anulada (400) sin motivo
    const resBAs = await patchStatus(invId, 'anulada');
    if (resBAs.status !== 400) {
      console.error(`ERROR: borrador->anulada sin motivo esperaba 400, obtuvo ${resBAs.status}`);
      process.exit(1);
    }
    
    // borrador -> emitida (200) y assert de contabilidad
    const resBE = await patchStatus(invId, 'emitida');
    if (resBE.status !== 200) {
      console.error(`ERROR: borrador->emitida esperaba 200, obtuvo ${resBE.status}`);
      process.exit(1);
    }
    const acc1 = await pool.query(`SELECT count(*)::int as count, sum(amount)::numeric as total FROM accounting_transactions WHERE reference_type = 'invoice' AND reference_id = $1 AND type = 'ingreso'`, [invId]);
    if (acc1.rows[0].count !== 1 || Number(acc1.rows[0].total) !== total) {
      console.error(`ERROR: No se creó correctamente el asiento de ingreso al emitir. Count: ${acc1.rows[0].count}, Sum: ${acc1.rows[0].total}`);
      process.exit(1);
    }
    
    // emitida -> pagada (200) y assert de dedupe y paid_at
    const resEP = await patchStatus(invId, 'pagada');
    if (resEP.status !== 200) {
      console.error(`ERROR: emitida->pagada esperaba 200, obtuvo ${resEP.status}`);
      process.exit(1);
    }
    const invCheck = await pool.query('SELECT paid_at FROM invoices WHERE id = $1', [invId]);
    if (!invCheck.rows[0].paid_at) {
      console.error('ERROR: paid_at sigue siendo null después de pagar');
      process.exit(1);
    }
    const acc2 = await pool.query(`SELECT count(*)::int as count FROM accounting_transactions WHERE reference_type = 'invoice' AND reference_id = $1 AND type = 'ingreso'`, [invId]);
    if (acc2.rows[0].count !== 1) {
      console.error(`ERROR: dedupe falló. Se esperaban 1 ingreso, hay ${acc2.rows[0].count}`);
      process.exit(1);
    }
    
    // ya emitida (pagada) -> emitida (400)
    const resEE = await patchStatus(invId, 'emitida');
    if (resEE.status !== 400) {
      console.error(`ERROR: re-emitir esperaba 400, obtuvo ${resEE.status}`);
      process.exit(1);
    }
    const acc2b = await pool.query(`SELECT count(*)::int as count FROM accounting_transactions WHERE reference_type = 'invoice' AND reference_id = $1 AND type = 'ingreso'`, [invId]);
    if (acc2b.rows[0].count !== 1) {
      console.error(`ERROR: se alteró el ingreso en transición fallida`);
      process.exit(1);
    }
    
    // pagada -> anulada (200) con motivo
    const resPAc = await patchStatus(invId, 'anulada', 'Error de prueba');
    if (resPAc.status !== 200) {
      console.error(`ERROR: pagada->anulada con motivo esperaba 200, obtuvo ${resPAc.status}`);
      process.exit(1);
    }
    const acc3 = await pool.query(`SELECT count(*)::int as count FROM accounting_transactions WHERE reference_type = 'invoice' AND reference_id = $1 AND type = 'egreso'`, [invId]);
    const acc4 = await pool.query(`SELECT count(*)::int as count FROM accounting_transactions WHERE reference_type = 'invoice' AND reference_id = $1 AND type = 'ingreso'`, [invId]);
    if (acc3.rows[0].count !== 1 || acc4.rows[0].count !== 1) {
      console.error(`ERROR: reversión fallida. Ingresos: ${acc4.rows[0].count}, Egresos: ${acc3.rows[0].count}`);
      process.exit(1);
    }
    
    // anulada -> emitida (400)
    const resAE = await patchStatus(invId, 'emitida');
    if (resAE.status !== 400) {
      console.error(`ERROR: anulada->emitida esperaba 400, obtuvo ${resAE.status}`);
      process.exit(1);
    }
    
    // Cleanup de facturas en estricto orden por dependencias (NO ACTION)
    await pool.query('DELETE FROM accounting_transactions WHERE reference_type = $1 AND reference_id = ANY($2)', ['invoice', [invId, otherInvId]]);
    await pool.query('DELETE FROM invoices WHERE id = ANY($1)', [[invId, otherInvId]]);
    await pool.query('DELETE FROM restaurants WHERE id = ANY($1)', [[myRestId, otherRestId]]);
    
    const checkAcc = await pool.query('SELECT count(*)::int as count FROM accounting_transactions WHERE reference_type = $1 AND reference_id = ANY($2)', ['invoice', [invId, otherInvId]]);
    if (checkAcc.rows[0].count > 0) { console.error('ERROR: Cleanup falló en accounting_transactions'); process.exit(1); }

    const invoiceResults = [
      { Transicion: 'Factura ajena', HTTP: resAjeno.status, Expected: 403 },
      { Transicion: 'borrador -> pagada', HTTP: resBP.status, Expected: 400 },
      { Transicion: 'borrador -> anulada (sin motivo)', HTTP: resBAs.status, Expected: 400 },
      { Transicion: 'borrador -> emitida', HTTP: resBE.status, Expected: 200 },
      { Transicion: 'emitida -> pagada', HTTP: resEP.status, Expected: 200 },
      { Transicion: 'pagada -> emitida', HTTP: resEE.status, Expected: 400 },
      { Transicion: 'pagada -> anulada (con motivo)', HTTP: resPAc.status, Expected: 200 },
      { Transicion: 'anulada -> emitida', HTTP: resAE.status, Expected: 400 },
    ];
    console.table(invoiceResults);
    console.log('✅ Pruebas de facturas OK.');
  }

  server.close();
  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

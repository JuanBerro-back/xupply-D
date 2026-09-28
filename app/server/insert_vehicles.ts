import { pool } from './src/config/db';

async function seedVehicles() {
  try {
    const moto = await pool.query(
      `INSERT INTO vehicles (name, plate, type, is_active, imei, gps_validated) 
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING *`,
      ['Moto Domicilios', 'MOT-123', 'moto', true, 'imei-moto', true]
    );
    console.log('Moto added:', moto.rowCount ? 'Yes' : 'Already exists');

    const cargo = await pool.query(
      `INSERT INTO vehicles (name, plate, type, is_active, imei, gps_validated) 
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING *`,
      ['Furgón Carga', 'CAR-456', 'furgon', true, 'imei-cargo', true]
    );
    console.log('Cargo added:', cargo.rowCount ? 'Yes' : 'Already exists');

  } catch (err) {
    console.error('Error inserting vehicles:', err);
  } finally {
    pool.end();
  }
}

seedVehicles();

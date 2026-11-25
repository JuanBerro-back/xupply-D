import { query } from '../../../shared/config/db';

export async function checkUserScope(reqUser: any, targetId: string | number, isDeactivate = false) {
  const target = await query('SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [targetId]);
  if (!target.rowCount) return { status: 404, error: 'Usuario no encontrado' };
  const targetUser = target.rows[0];

  if (reqUser.role === 'proveedor_admin') {
    if (targetUser.role_name !== 'domiciliario' || targetUser.supplier_id !== reqUser.supplier_id) {
      return { status: 403, error: 'Solo puedes gestionar domiciliarios de tu empresa' };
    }
  } else if (reqUser.role === 'gerente') {
    if (targetUser.role_name !== 'empleado' || targetUser.restaurant_id !== reqUser.restaurant_id) {
      return { status: 403, error: 'Solo puedes gestionar empleados de tu restaurante' };
    }
  } else if (reqUser.role === 'admin') {
    if (isDeactivate && targetUser.role_name === 'admin') {
      if (targetUser.id === reqUser.id) return { status: 400, error: 'No puedes desactivarte a ti mismo' };
      const admins = await query("SELECT count(*) as c FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.is_active = true");
      if (Number(admins.rows[0].c) <= 1 && targetUser.is_active) {
        return { status: 400, error: 'No puedes desactivar al último administrador activo' };
      }
    }
  }
  return { status: 200, user: targetUser };
}

import Modal from '../../../shared/ui/Modal';
import { AdminUser } from '../types';

export default function UserDetailModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  return (
    <Modal title="Detalles del Usuario" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="h-12 w-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-xl uppercase">
            {user.name[0]}
          </div>
          <div>
            <p className="font-black text-lg text-slate-900 dark:text-white">{user.name}</p>
            <p className="font-mono text-xs text-slate-500">@{user.username}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rol</p>
            <p className="font-semibold">{user.role_label}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</p>
            <p className={user.is_active ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
              {user.is_active ? 'Activo' : 'Inactivo'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vinculación (Tenant)</p>
            <p>{user.restaurant_name ? `Restaurante: ${user.restaurant_name}` : ''}</p>
            <p>{user.branch_name ? `Sucursal: ${user.branch_name}` : ''}</p>
            <p>{user.supplier_name ? `Proveedor: ${user.supplier_name}` : ''}</p>
            {!user.restaurant_id && !user.supplier_id && <p>Plataforma (Acceso Global)</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Último Acceso</p>
            <p>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Nunca'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Creación</p>
            <p>{new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

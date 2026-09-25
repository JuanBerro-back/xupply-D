import { useState, useEffect, FormEvent, useMemo } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { IconClose, IconEdit, IconMotorcycle, IconCheck } from '../../components/Icons';

// Interfaces locales
interface AdminUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_name: string;
  role_label: string;
  role_id: number;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  restaurant_id: number | null;
  branch_id: number | null;
  supplier_id: number | null;
  restaurant_name?: string;
  branch_name?: string;
  supplier_name?: string;
}

interface Role {
  id: number;
  name: string;
  display_name: string;
}

interface TenantOpt {
  id: number;
  name: string;
}

export default function UsuariosAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [restaurants, setRestaurants] = useState<TenantOpt[]>([]);
  const [branches, setBranches] = useState<TenantOpt[]>([]);
  const [suppliers, setSuppliers] = useState<TenantOpt[]>([]);
  
  // Estados UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados Tabla y Filtros
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modales
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showDetail, setShowDetail] = useState<AdminUser | null>(null);
  
  // Confirmaciones
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmToggleId, setConfirmToggleId] = useState<AdminUser | null>(null);

  // Form
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role_id: 3,
    restaurant_id: '',
    branch_id: '',
    supplier_id: '',
    vehicle_type: 'ninguno',
    vehicle_plate: ''
  });

  // Efecto Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Carga inicial
  useEffect(() => {
    loadCatalogs();
  }, []);

  // Carga de tabla dependiente de filtros
  useEffect(() => {
    loadUsers();
  }, [debouncedSearch, filterRole, filterActive, page]);

  const loadCatalogs = async () => {
    try {
      const [r, rest, sup] = await Promise.all([
        api<Role[]>('/admin/roles'),
        api<TenantOpt[]>('/admin/restaurants'),
        api<TenantOpt[]>('/admin/suppliers')
      ]);
      setRoles(r);
      setRestaurants(rest);
      setSuppliers(sup);
    } catch (err: any) {
      setError(err.message || 'Error cargando catálogos');
    }
  };

  const loadBranches = async (restaurantId: number) => {
    if (!restaurantId) {
      setBranches([]);
      return;
    }
    try {
      const b = await api<TenantOpt[]>(`/admin/branches?restaurant_id=${restaurantId}`);
      setBranches(b);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      let url = `/admin/users?page=${page}&limit=10`;
      if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
      if (filterRole) url += `&role_id=${filterRole}`;
      if (filterActive) url += `&is_active=${filterActive}`;

      const res = await api<{data: AdminUser[], meta: any}>(url);
      setUsers(res.data);
      setTotalPages(res.meta.pages);
      setTotalRecords(res.meta.total);
    } catch (err: any) {
      setError(err.message || 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (user?: AdminUser) => {
    setError('');
    setSuccess('');
    if (user) {
      setEditingUser(user);
      setForm({
        username: user.username,
        password: '', // Solo se usa si se quiere cambiar, pero mejor otro botón
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        role_id: user.role_id,
        restaurant_id: user.restaurant_id ? String(user.restaurant_id) : '',
        branch_id: user.branch_id ? String(user.branch_id) : '',
        supplier_id: user.supplier_id ? String(user.supplier_id) : '',
        vehicle_type: user.vehicle_type || 'ninguno',
        vehicle_plate: user.vehicle_plate || ''
      });
      if (user.restaurant_id) loadBranches(user.restaurant_id);
    } else {
      setEditingUser(null);
      setForm({
        username: '',
        password: '',
        name: '',
        email: '',
        phone: '',
        role_id: roles.find(r => r.name === 'empleado')?.id || 3,
        restaurant_id: '',
        branch_id: '',
        supplier_id: '',
        vehicle_type: 'ninguno',
        vehicle_plate: ''
      });
      setBranches([]);
    }
    setShowForm(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Si cambia restaurante, recargar sucursales
    if (name === 'restaurant_id') {
      setForm(prev => ({ ...prev, branch_id: '' }));
      loadBranches(Number(value));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role_id: Number(form.role_id),
        restaurant_id: form.restaurant_id ? Number(form.restaurant_id) : null,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        vehicle_type: form.vehicle_type !== 'ninguno' ? form.vehicle_type : null,
        vehicle_plate: form.vehicle_plate.trim().toUpperCase() || null
      };

      if (editingUser) {
        await api(`/admin/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setSuccess('Usuario actualizado con éxito');
      } else {
        payload.username = form.username.trim();
        payload.password = form.password;
        await api('/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccess('Usuario creado con éxito');
      }
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Error guardando usuario');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setError('');
    setSuccess('');
    try {
      await api(`/admin/users/${confirmDeleteId}`, { method: 'DELETE' });
      setSuccess('Usuario eliminado definitivamente');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Error eliminando usuario');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleToggleActive = async () => {
    if (!confirmToggleId) return;
    setError('');
    setSuccess('');
    try {
      const action = confirmToggleId.is_active ? 'deactivate' : 'activate';
      await api(`/admin/users/${confirmToggleId.id}/${action}`, { method: 'PATCH' });
      setSuccess(`Usuario ${confirmToggleId.is_active ? 'desactivado' : 'activado'} con éxito`);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Error cambiando estado');
    } finally {
      setConfirmToggleId(null);
    }
  };

  const handleResetPassword = async (id: number) => {
    const newPass = prompt('Ingresa la nueva contraseña (mínimo 8 caracteres):');
    if (!newPass || newPass.length < 8) {
      if (newPass !== null) alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    try {
      await api(`/admin/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPass })
      });
      setSuccess('Contraseña actualizada');
    } catch (err: any) {
      setError(err.message || 'Error reseteando contraseña');
    }
  };
  
  const handleViewDetail = async (id: number) => {
    try {
      const u = await api<AdminUser>(`/admin/users/${id}`);
      setShowDetail(u);
    } catch (err: any) {
      setError(err.message || 'Error cargando detalle');
    }
  };

  // Ayudante para nombre de inquilino
  const getTenantName = (u: AdminUser) => {
    if (u.restaurant_id) return u.restaurant_name || `Restaurante #${u.restaurant_id}`;
    if (u.supplier_id) return u.supplier_name || `Proveedor #${u.supplier_id}`;
    return 'Plataforma (Global)';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total: {totalRecords} registros</p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="rounded-xl bg-brand px-4 py-2 font-bold text-white shadow-sm hover:bg-brand-dark transition shrink-0"
        >
          + Nuevo Usuario
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 p-3 text-sm text-rose-700 dark:text-rose-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><IconClose className="w-4 h-4" /></button>
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><IconClose className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input 
          type="text" 
          placeholder="Buscar nombre, usuario..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 dark:text-white"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 dark:text-white"
        >
          <option value="">Cualquier Rol</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 dark:text-white"
        >
          <option value="">Cualquier Estado</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Tabla (Desktop) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-extrabold text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol / Tenant</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8">Cargando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">No se encontraron usuarios</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {u.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                        <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.role_label}</p>
                    <p className="text-[11px] text-slate-500">{getTenantName(u)}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      u.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                    }`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => handleViewDetail(u.id)} className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">Ver</button>
                    <button onClick={() => handleOpenForm(u)} className="text-xs font-semibold px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50">Edit</button>
                    <button onClick={() => handleResetPassword(u.id)} className="text-xs font-semibold px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md">Clave</button>
                    <button onClick={() => setConfirmToggleId(u)} className={`text-xs font-semibold px-2 py-1 rounded-md ${u.is_active ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{u.is_active ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => setConfirmDeleteId(u.id)} className="text-xs font-semibold px-2 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-md">Eliminar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas Mobile */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {loading ? (
          <div className="text-center py-8">Cargando...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed rounded-xl border-slate-300 dark:border-slate-700">No se encontraron usuarios</div>
        ) : (
          users.map(u => (
            <div key={u.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                   <div className="h-8 w-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {u.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{u.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">@{u.username} · {u.role_label}</p>
                    </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  u.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                }`}>
                  {u.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button onClick={() => handleViewDetail(u.id)} className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">Detalle</button>
                <button onClick={() => handleOpenForm(u)} className="text-[10px] font-semibold px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md">Editar</button>
                <button onClick={() => setConfirmToggleId(u)} className={`text-[10px] font-semibold px-2 py-1 rounded-md ${u.is_active ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30'}`}>{u.is_active ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50 dark:text-slate-300"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm font-bold dark:text-slate-300">Página {page} de {totalPages}</span>
          <button 
            disabled={page === totalPages} 
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50 dark:text-slate-300"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal Formulario */}
      {showForm && (
        <Modal
          title={editingUser ? `Editar: ${editingUser.name}` : 'Crear Usuario'}
          onClose={() => setShowForm(false)}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Username *</label>
                <input 
                  name="username" value={form.username} onChange={handleFormChange} required disabled={!!editingUser}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm disabled:bg-slate-100 dark:disabled:bg-slate-900 dark:text-white"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Contraseña *</label>
                  <input 
                    name="password" type="password" value={form.password} onChange={handleFormChange} required minLength={8}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Nombre *</label>
                <input 
                  name="name" value={form.name} onChange={handleFormChange} required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Rol *</label>
                <select 
                  name="role_id" value={form.role_id} onChange={handleFormChange} required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
                >
                  {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Correo</label>
                <input 
                  name="email" type="email" value={form.email} onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Teléfono</label>
                <input 
                  name="phone" value={form.phone} onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vinculación a Tenant</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Restaurante</label>
                  <select 
                    name="restaurant_id" value={form.restaurant_id} onChange={handleFormChange}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs dark:text-white"
                  >
                    <option value="">Ninguno</option>
                    {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Sucursal</label>
                  <select 
                    name="branch_id" value={form.branch_id} onChange={handleFormChange} disabled={!form.restaurant_id}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50 dark:text-white"
                  >
                    <option value="">Ninguna</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Proveedor</label>
                  <select 
                    name="supplier_id" value={form.supplier_id} onChange={handleFormChange}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs dark:text-white"
                  >
                    <option value="">Ninguno</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Vehículos para domiciliarios/etc */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vehículo (Opcional)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Tipo</label>
                  <select 
                    name="vehicle_type" value={form.vehicle_type} onChange={handleFormChange}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs dark:text-white"
                  >
                    <option value="ninguno">Ninguno</option>
                    <option value="moto">Moto</option>
                    <option value="camion">Camión</option>
                    <option value="furgon">Furgón</option>
                    <option value="camioneta">Camioneta</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">Placa</label>
                  <input 
                    name="vehicle_plate" value={form.vehicle_plate} onChange={handleFormChange}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs uppercase dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-brand hover:bg-brand-dark rounded-xl">
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Detalle */}
      {showDetail && (
        <Modal title="Detalles del Usuario" onClose={() => setShowDetail(null)} maxWidth="max-w-md">
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="h-12 w-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-xl uppercase">
                {showDetail.name[0]}
              </div>
              <div>
                <p className="font-black text-lg text-slate-900 dark:text-white">{showDetail.name}</p>
                <p className="font-mono text-xs text-slate-500">@{showDetail.username}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rol</p>
                <p className="font-semibold">{showDetail.role_label}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</p>
                <p className={showDetail.is_active ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {showDetail.is_active ? 'Activo' : 'Inactivo'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vinculación (Tenant)</p>
                <p>{showDetail.restaurant_name ? `Restaurante: ${showDetail.restaurant_name}` : ''}</p>
                <p>{showDetail.branch_name ? `Sucursal: ${showDetail.branch_name}` : ''}</p>
                <p>{showDetail.supplier_name ? `Proveedor: ${showDetail.supplier_name}` : ''}</p>
                {!showDetail.restaurant_id && !showDetail.supplier_id && <p>Plataforma (Acceso Global)</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Último Acceso</p>
                <p>{showDetail.last_login ? new Date(showDetail.last_login).toLocaleString() : 'Nunca'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Creación</p>
                <p>{new Date(showDetail.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ConfirmDialogs */}
      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title="Eliminar Usuario"
        message="¿Estás seguro de que deseas eliminar permanentemente este usuario? Esta acción no se puede deshacer y fallará si el usuario tiene información vinculada (pedidos, facturas)."
        isDestructive
        confirmText="Eliminar Definitivamente"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmDialog
        isOpen={!!confirmToggleId}
        title={confirmToggleId?.is_active ? 'Desactivar Usuario' : 'Activar Usuario'}
        message={
          confirmToggleId?.is_active
            ? `¿Deseas desactivar a ${confirmToggleId.name}? No podrá iniciar sesión hasta que sea reactivado.`
            : `¿Deseas reactivar a ${confirmToggleId?.name}? Volverá a tener acceso al sistema.`
        }
        confirmText={confirmToggleId?.is_active ? 'Sí, Desactivar' : 'Sí, Activar'}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirmToggleId(null)}
      />
    </div>
  );
}

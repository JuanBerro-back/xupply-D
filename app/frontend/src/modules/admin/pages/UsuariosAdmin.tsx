import { errorMessage, toast } from '../../../shared/utils/feedback';
import { useState, useEffect, FormEvent } from 'react';
import { api } from '../../../shared/api/client';
import { IconClose } from '../../../shared/ui/Icons';
import PasswordResetModal from '../../../shared/ui/PasswordResetModal';
import ConfirmDialog from '../../../shared/ui/ConfirmDialog';
import { AdminUser, AdminUserFormState, Role, RoleScope, TenantOpt } from '../types';
import UserFilters from '../components/UserFilters';
import UsersTable from '../components/UsersTable';
import UserCards from '../components/UserCards';
import UserPagination from '../components/UserPagination';
import UserFormModal from '../components/UserFormModal';
import UserDetailModal from '../components/UserDetailModal';

/** Ámbito del rol, igual que en el backend (lib/userTenant.ts). */
function scopeForRoleName(name?: string): RoleScope {
  if (name === 'gerente' || name === 'empleado') return 'restaurant';
  if (name === 'proveedor_admin' || name === 'domiciliario') return 'supplier';
  return 'platform';
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
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [savingReset, setSavingReset] = useState(false);

  // Form
  const [form, setForm] = useState<AdminUserFormState>({
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

  const selectedRole = roles.find((r) => r.id === Number(form.role_id));
  const roleScope = scopeForRoleName(selectedRole?.name);

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

    // Al cambiar de rol se limpian los inquilinos que no aplican: un
    // verificador/admin no debe arrastrar restaurante ni proveedor.
    if (name === 'role_id') {
      const scope = scopeForRoleName(roles.find((r) => r.id === Number(value))?.name);
      setForm((prev) => ({
        ...prev,
        role_id: Number(value),
        restaurant_id: scope === 'restaurant' ? prev.restaurant_id : '',
        branch_id: scope === 'restaurant' ? prev.branch_id : '',
        supplier_id: scope === 'supplier' ? prev.supplier_id : '',
      }));
      if (scope !== 'restaurant') {
        setBranches([]);
      } else if (form.restaurant_id) {
        loadBranches(Number(form.restaurant_id));
      }
      return;
    }

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
        restaurant_id: roleScope === 'restaurant' && form.restaurant_id ? Number(form.restaurant_id) : null,
        branch_id: roleScope === 'restaurant' && form.branch_id ? Number(form.branch_id) : null,
        supplier_id: roleScope === 'supplier' && form.supplier_id ? Number(form.supplier_id) : null,
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

  const openResetPassword = (user: AdminUser) => {
    setResetUser(user);
    setResetPasswordValue('');
    setError('');
    setSuccess('');
  };

  const submitResetPassword = async () => {
    if (!resetUser) return;
    if (resetPasswordValue.length < 8) {
      toast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    setSavingReset(true);
    setError('');
    try {
      await api(`/admin/users/${resetUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      setSuccess(`Contraseña actualizada para ${resetUser.name}`);
      toast('Contraseña actualizada correctamente', 'success');
      setResetUser(null);
      setResetPasswordValue('');
    } catch (err: any) {
      setError(errorMessage(err, 'Error reseteando contraseña'));
      toast(errorMessage(err, 'Error reseteando contraseña'), 'error');
    } finally {
      setSavingReset(false);
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
      <UserFilters
        search={search}
        onSearchChange={setSearch}
        filterRole={filterRole}
        onFilterRoleChange={setFilterRole}
        roles={roles}
        filterActive={filterActive}
        onFilterActiveChange={setFilterActive}
      />

      {/* Tabla (Desktop) */}
      <UsersTable
        users={users}
        loading={loading}
        tenantNameOf={getTenantName}
        onViewDetail={handleViewDetail}
        onOpenForm={handleOpenForm}
        onResetPassword={openResetPassword}
        onToggleActive={setConfirmToggleId}
        onDelete={setConfirmDeleteId}
      />

      {/* Tarjetas Mobile */}
      <UserCards
        users={users}
        loading={loading}
        onViewDetail={handleViewDetail}
        onOpenForm={handleOpenForm}
        onToggleActive={setConfirmToggleId}
      />

      {/* Paginación */}
      {totalPages > 1 && (
        <UserPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Modal Formulario */}
      {showForm && (
        <UserFormModal
          form={form}
          editingUser={editingUser}
          roles={roles}
          restaurants={restaurants}
          branches={branches}
          suppliers={suppliers}
          roleScope={roleScope}
          selectedRole={selectedRole}
          onChange={handleFormChange}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Modal Detalle */}
      {showDetail && (
        <UserDetailModal user={showDetail} onClose={() => setShowDetail(null)} />
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

      {resetUser && (
        <PasswordResetModal
          name={resetUser.name}
          password={resetPasswordValue}
          saving={savingReset}
          dark
          onPasswordChange={setResetPasswordValue}
          onClose={() => {
            setResetUser(null);
            setResetPasswordValue('');
          }}
          onSubmit={() => void submitResetPassword()}
        />
      )}
    </div>
  );
}

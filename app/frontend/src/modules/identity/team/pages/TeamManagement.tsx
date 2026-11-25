import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../shared/context/AuthContext';
import { api } from '../../../../shared/api/client';
import { confirmAction, errorMessage, toast } from '../../../../shared/utils/feedback';
import { IconClose } from '../../../../shared/ui/Icons';
import PasswordResetModal from '../../../../shared/ui/PasswordResetModal';
import { TeamFormState, TeamRoleOption, TeamUser } from '../types';
import TeamFilters from '../components/TeamFilters';
import TeamUserFormModal from '../components/TeamUserFormModal';
import MobileUserCards from '../components/MobileUserCards';
import DesktopUserTable from '../components/DesktopUserTable';

const RESTAURANT_ROLES: TeamRoleOption[] = [
  { id: 3, name: 'empleado', label: 'Empleado Operativo' },
];

const SUPPLIER_ROLES: TeamRoleOption[] = [
  { id: 5, name: 'domiciliario', label: 'Domiciliario / Conductor de Entregas' },
];

export default function TeamManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  const isSupplier = user?.role === 'proveedor_admin';
  const defaultRoleId = isSupplier ? 5 : 3;

  const [form, setForm] = useState<TeamFormState>({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role_id: defaultRoleId,
    vehicle_type: 'ninguno',
    vehicle_plate: '',
  });
  const [passwordUser, setPasswordUser] = useState<TeamUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Filtros dinámicos
  const [activeTab, setActiveTab] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const availableRoles = isSupplier ? SUPPLIER_ROLES : RESTAURANT_ROLES;

  const loadUsers = async () => {
    try {
      const data = await api<TeamUser[]>('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      if (editingUser) {
        await api(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role_id: Number(form.role_id),
            vehicle_type: isSupplier && form.vehicle_type !== 'ninguno' ? form.vehicle_type : null,
            vehicle_plate: isSupplier ? form.vehicle_plate.trim().toUpperCase() || null : null,
          }),
        });
        setSuccessMsg('Usuario actualizado correctamente');
      } else {
        await api('/users', {
          method: 'POST',
          body: JSON.stringify({
            username: form.username.trim(),
            password: form.password,
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role_id: Number(form.role_id),
            vehicle_type: isSupplier && form.vehicle_type !== 'ninguno' ? form.vehicle_type : null,
            vehicle_plate: isSupplier ? form.vehicle_plate.trim().toUpperCase() || null : null,
          }),
        });
        setSuccessMsg(isSupplier ? 'Domiciliario creado exitosamente y disponible para asignación' : 'Empleado creado exitosamente');
      }
      setShowForm(false);
      setEditingUser(null);
      setForm({
        username: '',
        password: '',
        name: '',
        email: '',
        phone: '',
        role_id: defaultRoleId,
        vehicle_type: 'ninguno',
        vehicle_plate: '',
      });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (u: TeamUser) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      password: '',
      name: u.name,
      email: u.email || '',
      phone: u.phone || '',
      role_id: u.role_id || defaultRoleId,
      vehicle_type: u.vehicle_type || 'ninguno',
      vehicle_plate: u.vehicle_plate || '',
    });
    setShowForm(true);
  };

  const handleDeactivate = async (u: TeamUser) => {
    const action = u.is_active ? 'desactivar' : 'activar';
    if (!(await confirmAction({ title: u.is_active ? 'Desactivar usuario' : 'Activar usuario', message: '¿Deseas ' + action + ' a este usuario?', confirmText: u.is_active ? 'Desactivar' : 'Activar', destructive: u.is_active }))) return;
    try {
      await api(`/users/${u.id}/${u.is_active ? 'deactivate' : 'activate'}`, { method: 'PATCH' });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = (user: TeamUser) => {
    setPasswordUser(user);
    setNewPassword('');
  };

  const submitResetPassword = async () => {
    if (!passwordUser) return;
    if (newPassword.length < 8) {
      toast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api(`/users/${passwordUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      toast(`Contraseña actualizada para ${passwordUser.name}`, 'success');
      setPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // Filtrado según pestaña y búsqueda
  const filteredUsers = useMemo(() => {
    let list = users;
    if (activeTab === 'activos') list = list.filter((u) => u.is_active);
    else if (activeTab === 'inactivos') list = list.filter((u) => !u.is_active);

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role_label && u.role_label.toLowerCase().includes(q))
    );
  }, [users, activeTab, searchQuery]);

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Cargando equipo de trabajo...</div>;

  return (
    <div className="space-y-5">
      {/* Cabecera Principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>{isSupplier ? 'Gestión de Domiciliarios y Flota' : 'Gestión de Empleados del Restaurante'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isSupplier
              ? 'Administra tus conductores y repartidores para la entrega segura de pedidos a restaurantes.'
              : 'Administra el personal operativo y de cocina de tu restaurante.'}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
            setForm({
              username: '',
              password: '',
              name: '',
              email: '',
              phone: '',
              role_id: defaultRoleId,
              vehicle_type: 'ninguno',
              vehicle_plate: '',
            });
          }}
          className="rounded-xl bg-brand px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-brand-dark active:scale-95 transition flex items-center gap-1.5"
        >
          <span>+</span> {isSupplier ? 'Crear Domiciliario' : 'Crear Empleado'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 p-1" aria-label="Cerrar">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 p-1" aria-label="Cerrar">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pestañas de Filtrado y Buscador Dinámico */}
      <TeamFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        users={users}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Modal de Crear / Editar Usuario */}
      {showForm && (
        <TeamUserFormModal
          form={form}
          editingUser={editingUser}
          isSupplier={isSupplier}
          availableRoles={availableRoles}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {/* Vista Móvil: Tarjetas Responsivas (Especial para Android) */}
      <MobileUserCards
        users={filteredUsers}
        onEdit={handleEdit}
        onResetPassword={handleResetPassword}
        onDeactivate={handleDeactivate}
        onOpenLogistics={() => navigate('/logistica')}
      />

      {/* Vista Desktop: Tabla Dinámica */}
      <DesktopUserTable
        users={filteredUsers}
        onEdit={handleEdit}
        onResetPassword={handleResetPassword}
        onDeactivate={handleDeactivate}
        onOpenLogistics={() => navigate('/logistica')}
      />
      {passwordUser && (
        <PasswordResetModal
          name={passwordUser.name}
          password={newPassword}
          saving={savingPassword}
          description="de este usuario"
          onPasswordChange={setNewPassword}
          onClose={() => {
            setPasswordUser(null);
            setNewPassword('');
          }}
          onSubmit={() => void submitResetPassword()}
        />
      )}
    </div>
  );
}

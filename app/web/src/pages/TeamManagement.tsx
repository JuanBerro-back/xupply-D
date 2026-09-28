import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import { IconClose } from '../components/Icons';

interface TeamUser {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role_name: string;
  role_label?: string;
  role_id: number;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
}

const RESTAURANT_ROLES = [
  { id: 3, name: 'empleado', label: 'Empleado Operativo' },
];

const SUPPLIER_ROLES = [
  { id: 5, name: 'domiciliario', label: 'Domiciliario / Conductor de Entregas' },
];

function getVehicleBadge(type?: string | null, plate?: string | null) {
  if (!type || type === 'ninguno') return null;
  const t = type.toLowerCase();
  if (t === 'camion') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-800">
        <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM3 5h11v10H3V5zm11 3h4l3 4v3h-7V8z" />
        </svg>
        <span>Camión {plate ? `· ${plate}` : ''}</span>
      </span>
    );
  }
  if (t === 'furgon') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-800">
        <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2zm1 0a2 2 0 104 0m6 0a2 2 0 104 0" />
        </svg>
        <span>Furgón {plate ? `· ${plate}` : ''}</span>
      </span>
    );
  }
  if (t === 'camioneta') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800">
        <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM4 9l2-4h10l2 4M3 13h18v4H3v-4z" />
        </svg>
        <span>Camioneta {plate ? `· ${plate}` : ''}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-bold text-sky-800">
      <svg className="w-3.5 h-3.5 text-sky-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zm-7-6l3-4h3m-6 4l-3 4H5m7-4v4" />
      </svg>
      <span>Moto {plate ? `· ${plate}` : ''}</span>
    </span>
  );
}

export default function TeamManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  const isSupplier = user?.role === 'proveedor_admin';
  const defaultRoleId = isSupplier ? 5 : 3;

  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role_id: defaultRoleId,
    vehicle_type: 'ninguno',
    vehicle_plate: '',
  });
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
    if (!confirm(`¿Deseas ${action} a este usuario?`)) return;
    try {
      await api(`/users/${u.id}/${u.is_active ? 'deactivate' : 'activate'}`, { method: 'PATCH' });
      loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = async (id: number) => {
    const newPass = prompt('Ingresa la nueva contraseña (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) return;
    try {
      await api(`/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPass }),
      });
      alert('Contraseña actualizada correctamente');
    } catch (err) {
      alert((err as Error).message);
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

  const getRoleBadge = (roleId: number, roleName: string) => {
    if (roleId === 5 || roleName === 'domiciliario') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 border border-sky-200 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          <span>Domiciliario</span>
        </span>
      );
    }
    if (roleId === 2 || roleName === 'gerente') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          <span>Gerente</span>
        </span>
      );
    }
    if (roleId === 4 || roleName === 'proveedor_admin') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span>Proveedor Admin</span>
        </span>
      );
    }
    if (roleId === 1 || roleName === 'admin') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>Administrador</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        <span>Empleado</span>
      </span>
    );
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        {/* Pestañas Segmentadas */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'todos'
                ? 'bg-white text-brand shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('activos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'activos'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Activos</span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] text-emerald-800 font-black">
              {users.filter(u => u.is_active).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('inactivos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'inactivos'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inactivos ({users.filter(u => !u.is_active).length})
          </button>
        </div>

        {/* Campo de Búsqueda Rápida */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, tel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Limpiar búsqueda"
            >
              <IconClose className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Modal de Crear / Editar Usuario */}
      {showForm && (
        <Modal
          title={
            editingUser
              ? `Editar ${isSupplier ? 'Domiciliario' : 'Empleado'}: ${editingUser.name}`
              : `Crear Nuevo ${isSupplier ? 'Domiciliario' : 'Empleado'}`
          }
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!editingUser && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Nombre de Usuario (Login) *</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder={isSupplier ? 'ej. carlos_repartidor' : 'ej. juan_cocina'}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Nombre Completo *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ej. Carlos Mendoza"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                required
              />
            </div>

            {!editingUser && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Contraseña *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  required
                  minLength={6}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Teléfono Móvil (WhatsApp)</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="ej. 3151234567"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Correo Electrónico</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ej. carlos@correo.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>

            {availableRoles.length > 1 ? (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Rol en la Organización *</label>
                <select
                  value={form.role_id}
                  onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
                >
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold block">Rol Asignado:</span>
                <span className="text-xs font-bold text-slate-800">{availableRoles[0]?.label}</span>
              </div>
            )}

            {/* Asignación de Vehículo (Sólo para Proveedores / Domiciliarios) */}
            {isSupplier && (
              <div className="pt-2.5 border-t border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Asignación de Vehículo (Camión / Moto)</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Tipo de Vehículo</label>
                    <select
                      value={form.vehicle_type}
                      onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
                    >
                      <option value="ninguno">Sin vehículo asignado</option>
                      <option value="moto">Moto (Motocicleta de reparto)</option>
                      <option value="camion">Camión (Carga pesada)</option>
                      <option value="furgon">Furgón (Carga seca / refrigerada)</option>
                      <option value="camioneta">Camioneta (Vehículo utilitario)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Placa del Vehículo</label>
                    <input
                      value={form.vehicle_plate}
                      onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })}
                      placeholder="Ej: ABC-123"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white hover:bg-brand-dark active:scale-95 transition shadow-sm"
              >
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}
                className="flex-1 rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Vista Móvil: Tarjetas Responsivas (Especial para Android) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredUsers.map((u) => {
          const isDom = u.role_id === 5 || u.role_name === 'domiciliario';

          return (
            <div
              key={u.id}
              className={`rounded-2xl border p-4 shadow-sm bg-white transition ${
                isDom ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-lg ${
                      isDom
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-brand/10 text-brand'
                    }`}
                  >
                    {u.name ? u.name[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{u.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                    {u.vehicle_type && u.vehicle_type !== 'ninguno' && (
                      <div className="mt-1">
                        {getVehicleBadge(u.vehicle_type, u.vehicle_plate)}
                      </div>
                    )}
                  </div>
                </div>
                {getRoleBadge(u.role_id, u.role_name)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">TELÉFONO</span>
                  {u.phone ? (
                    <a href={`tel:${u.phone}`} className="text-brand font-medium inline-flex items-center gap-1">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{u.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400">Sin teléfono</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ESTADO</span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      u.is_active ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              {/* Botón destacado para Domiciliarios */}
              {isDom && (
                <div className="mt-3">
                  <button
                    onClick={() => navigate('/logistica')}
                    className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 text-white font-bold text-xs py-2 shadow-sm hover:from-sky-700 hover:to-sky-800 transition flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>Asignar Pedido / Ver en Mapa GPS</span>
                  </button>
                </div>
              )}

              {/* Acciones de Edición */}
              <div className="mt-3 flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleEdit(u)}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleResetPassword(u.id)}
                  className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Clave
                </button>
                <button
                  onClick={() => handleDeactivate(u)}
                  className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  {u.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
            <div className="h-8 w-8 mx-auto mb-2 text-slate-300 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="font-bold text-slate-800">No se encontraron usuarios</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otra pestaña o limpia el buscador.</p>
          </div>
        )}
      </div>

      {/* Vista Desktop: Tabla Dinámica */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-500 border-b">
            <tr>
              <th className="px-5 py-3.5">Usuario</th>
              <th className="px-5 py-3.5">Nombre</th>
              <th className="px-5 py-3.5">Rol</th>
              <th className="px-5 py-3.5">Vehículo</th>
              <th className="px-5 py-3.5">Contacto</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((u) => {
              const isDom = u.role_id === 5 || u.role_name === 'domiciliario';

              return (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5 font-bold text-slate-900 font-mono text-xs">
                    {u.username}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-800">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.email || 'Sin correo'}</div>
                  </td>
                  <td className="px-5 py-3.5">{getRoleBadge(u.role_id, u.role_name)}</td>
                  <td className="px-5 py-3.5">
                    {getVehicleBadge(u.vehicle_type, u.vehicle_plate) || (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">
                    {u.phone ? (
                      <a href={`tel:${u.phone}`} className="text-brand font-medium hover:underline inline-flex items-center gap-1">
                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{u.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isDom && (
                        <button
                          onClick={() => navigate('/logistica')}
                          className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-700 shadow-sm inline-flex items-center gap-1"
                          title="Ver en mapa GPS y asignar pedidos"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span>Asignar Pedido</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(u)}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                      >
                        Clave
                      </button>
                      <button
                        onClick={() => handleDeactivate(u)}
                        className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200"
                      >
                        {u.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium">
                  No hay usuarios registrados en esta categoría
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

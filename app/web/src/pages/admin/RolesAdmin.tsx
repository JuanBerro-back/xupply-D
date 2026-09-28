import { useState, useEffect, FormEvent } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { IconClose } from '../../components/Icons';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: number;
  name: string;
  description: string | null;
  roles_count?: string;
}

export default function RolesAdmin() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsList, setPermissionsList] = useState<{ list: Permission[], grouped: Record<string, Permission[]> }>({ list: [], grouped: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modales
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showPermsModal, setShowPermsModal] = useState<Role | null>(null);

  // Formularios
  const [form, setForm] = useState({ name: '', display_name: '', description: '' });
  const [rolePermissions, setRolePermissions] = useState<Set<number>>(new Set());
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api<Role[]>('/admin/roles'),
        api<{ list: Permission[], grouped: Record<string, Permission[]> }>('/admin/permissions')
      ]);
      setRoles(r);
      setPermissionsList(p);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (role?: Role) => {
    setError(''); setSuccess('');
    if (role) {
      setEditingRole(role);
      setForm({ name: role.name, display_name: role.display_name, description: role.description || '' });
    } else {
      setEditingRole(null);
      setForm({ name: '', display_name: '', description: '' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const payload = {
        name: form.name.trim().toLowerCase(),
        display_name: form.display_name.trim(),
        description: form.description.trim() || null
      };

      if (editingRole) {
        await api(`/admin/roles/${editingRole.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setSuccess('Rol actualizado');
      } else {
        await api('/admin/roles', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('Rol creado');
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Error guardando rol');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setError(''); setSuccess('');
    try {
      await api(`/admin/roles/${confirmDeleteId}`, { method: 'DELETE' });
      setSuccess('Rol eliminado');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Error eliminando rol');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleOpenPerms = async (role: Role) => {
    setError(''); setSuccess('');
    setShowPermsModal(role);
    setRolePermissions(new Set());
    try {
      const currentPerms = await api<number[]>(`/admin/roles/${role.id}/permissions`);
      setRolePermissions(new Set(currentPerms));
    } catch (err: any) {
      setError(err.message || 'Error cargando permisos del rol');
    }
  };

  const handleTogglePermission = (id: number) => {
    const updated = new Set(rolePermissions);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setRolePermissions(updated);
  };

  const handleSavePermissions = async () => {
    if (!showPermsModal) return;
    setSavingPerms(true);
    setError(''); setSuccess('');
    try {
      await api(`/admin/roles/${showPermsModal.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: Array.from(rolePermissions) })
      });
      setSuccess('Permisos asignados con éxito. Los usuarios activos necesitarán re-login.');
      setShowPermsModal(null);
    } catch (err: any) {
      setError(err.message || 'Error guardando permisos');
    } finally {
      setSavingPerms(false);
    }
  };

  const isProtected = (id: number) => id >= 1 && id <= 5;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4 sm:space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">Gestión de Roles</h1>
          <p className="text-sm text-slate-500">Configuración de perfiles y asignación de permisos (RBAC)</p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="rounded-xl bg-brand px-4 py-2 font-bold text-white shadow-sm hover:bg-brand-dark transition shrink-0"
        >
          + Nuevo Rol
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 p-3 text-sm text-rose-700 flex justify-between">
          <span>{error}</span><button onClick={() => setError('')}><IconClose className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 flex justify-between">
          <span>{success}</span><button onClick={() => setSuccess('')}><IconClose className="w-4 h-4" /></button>
        </div>
      )}

      {/* Grid de Roles */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Cargando roles...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(r => (
              <div key={r.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                      {r.display_name}
                      {isProtected(r.id) && <span title="Rol base del sistema" className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold">Base</span>}
                    </h3>
                    <p className="font-mono text-xs text-slate-500 mt-1">name: {r.name}</p>
                  </div>
                  <div className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg shadow-sm">
                    ID: {r.id}
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-1">
                  {r.description || 'Sin descripción'}
                </p>
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button onClick={() => handleOpenPerms(r)} className="text-xs font-bold px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-dark transition">
                    Ver Permisos
                  </button>
                  <button onClick={() => handleOpenForm(r)} className="text-xs font-bold px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition">
                    Editar
                  </button>
                  <button 
                    onClick={() => setConfirmDeleteId(r.id)} 
                    disabled={isProtected(r.id)}
                    className="text-xs font-bold px-3 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg hover:bg-rose-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    title={isProtected(r.id) ? "No se pueden eliminar roles base" : "Eliminar rol"}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <Modal title={editingRole ? `Editar Rol: ${editingRole.display_name}` : 'Nuevo Rol'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Identificador Interno (snake_case) *</label>
              <input 
                value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                disabled={editingRole ? isProtected(editingRole.id) : false}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-50 dark:text-white"
                placeholder="ej: supervisor_ventas"
              />
              {editingRole && isProtected(editingRole.id) && <p className="text-[10px] text-orange-500 mt-1">El identificador interno de un rol base no puede modificarse.</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Nombre a Mostrar *</label>
              <input 
                value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
                placeholder="ej: Supervisor de Ventas"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Descripción</label>
              <textarea 
                value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-brand hover:bg-brand-dark rounded-xl">Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {showPermsModal && (
        <Modal title={`Permisos: ${showPermsModal.display_name}`} onClose={() => setShowPermsModal(null)} maxWidth="max-w-4xl">
          {showPermsModal.id === 1 ? (
            <div className="p-8 text-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <h3 className="text-lg font-black text-blue-800 dark:text-blue-300 mb-2">Acceso Total</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">El rol de Administrador tiene acceso global implícito a todos los módulos mediante bypass. No es necesario ni posible editar sus permisos detallados.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6">
                {Object.entries(permissionsList.grouped).map(([module, perms]) => (
                  <div key={module}>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-3 border-b border-slate-200 dark:border-slate-700 pb-1">{module}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {perms.map(p => (
                        <label key={p.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${rolePermissions.has(p.id) ? 'border-brand bg-brand/5 dark:bg-brand/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                          <input 
                            type="checkbox" 
                            checked={rolePermissions.has(p.id)}
                            onChange={() => handleTogglePermission(p.id)}
                            className="mt-1 w-4 h-4 text-brand rounded focus:ring-brand accent-brand"
                          />
                          <div>
                            <p className="font-bold text-sm text-slate-800 dark:text-white">{p.name}</p>
                            <p className="text-xs text-slate-500 leading-tight mt-0.5">{p.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 font-bold">{rolePermissions.size} permisos seleccionados</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowPermsModal(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-xl hover:bg-slate-100">Cancelar</button>
                  <button onClick={handleSavePermissions} disabled={savingPerms} className="px-4 py-2 text-sm font-bold text-white bg-brand hover:bg-brand-dark rounded-xl disabled:opacity-50">
                    {savingPerms ? 'Guardando...' : 'Guardar Asignación'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title="Eliminar Rol"
        message="¿Estás seguro de que deseas eliminar este rol? Fallará si existen usuarios asignados a él."
        isDestructive
        confirmText="Eliminar Rol"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

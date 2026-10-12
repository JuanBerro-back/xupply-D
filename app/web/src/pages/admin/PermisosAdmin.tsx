import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
}

interface Permission {
  id: number;
  name: string;
  description: string;
  roles_count?: string;
  created_at?: string;
}

export default function PermisosAdmin() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [assignedPerms, setAssignedPerms] = useState<Set<number>>(new Set());
  const [groupedPerms, setGroupedPerms] = useState<Record<string, Permission[]>>({});
  const [allPerms, setAllPerms] = useState<Permission[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'manage' | 'catalog'>('manage');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rolesData, permsData] = await Promise.all([
        api<Role[]>('/admin/roles'),
        api<{ list: Permission[]; grouped: Record<string, Permission[]> }>('/admin/permissions'),
      ]);

      setRoles(rolesData);
      setAllPerms(permsData.list);
      setGroupedPerms(permsData.grouped);

      // Por defecto seleccionar el primer rol configurable (ej. Gerente o Empleado)
      const defaultRole = rolesData.find((r) => r.id === 2) || rolesData[0];
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
        await loadRolePermissions(defaultRole.id);
      }
    } catch (err: any) {
      setError(err.message || 'Error cargando datos de roles y permisos');
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: number) => {
    setLoadingPerms(true);
    setError('');
    try {
      const perms = await api<number[]>(`/admin/roles/${roleId}/permissions`);
      setAssignedPerms(new Set(perms));
    } catch (err: any) {
      setError(err.message || 'Error cargando permisos asignados al rol');
    } finally {
      setLoadingPerms(false);
    }
  };

  const handleSelectRole = async (roleId: number) => {
    setSelectedRoleId(roleId);
    setSuccess('');
    setError('');
    await loadRolePermissions(roleId);
  };

  const handleTogglePermission = (pId: number) => {
    if (selectedRoleId === 1) return; // Admin tiene bypass
    const updated = new Set(assignedPerms);
    if (updated.has(pId)) {
      updated.delete(pId);
    } else {
      updated.add(pId);
    }
    setAssignedPerms(updated);
  };

  const handleToggleModule = (modulePermissions: Permission[]) => {
    if (selectedRoleId === 1) return;
    const moduleIds = modulePermissions.map((p) => p.id);
    const allSelected = moduleIds.every((id) => assignedPerms.has(id));

    const updated = new Set(assignedPerms);
    if (allSelected) {
      moduleIds.forEach((id) => updated.delete(id));
    } else {
      moduleIds.forEach((id) => updated.add(id));
    }
    setAssignedPerms(updated);
  };

  const handleSelectAll = () => {
    if (selectedRoleId === 1) return;
    const all = new Set(allPerms.map((p) => p.id));
    setAssignedPerms(all);
  };

  const handleDeselectAll = () => {
    if (selectedRoleId === 1) return;
    setAssignedPerms(new Set());
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;
    if (selectedRoleId === 1) {
      setSuccess('El rol Administrador cuenta con bypass total e irrestricto del sistema.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api(`/admin/roles/${selectedRoleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: Array.from(assignedPerms) }),
      });

      const selectedRoleObj = roles.find((r) => r.id === selectedRoleId);
      setSuccess(
        `Permisos guardados con éxito para "${selectedRoleObj?.display_name}". Los usuarios activos fueron actualizados por WebSocket.`
      );
    } catch (err: any) {
      setError(err.message || 'Error guardando permisos para el rol');
    } finally {
      setSaving(false);
    }
  };

  const currentRole = roles.find((r) => r.id === selectedRoleId);
  const isAdminRole = selectedRoleId === 1;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
              Gestión de Permisos (RBAC)
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Control de Accesos
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Concede y revoca privilegios a cada perfil del sistema. Las modificaciones se sincronizan en vivo.
          </p>
        </div>

        {/* Selector de Modo */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold shrink-0">
          <button
            onClick={() => setViewMode('manage')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewMode === 'manage'
                ? 'bg-white dark:bg-slate-700 text-brand dark:text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Asignar por Rol
          </button>
          <button
            onClick={() => setViewMode('catalog')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewMode === 'catalog'
                ? 'bg-white dark:bg-slate-700 text-brand dark:text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Catálogo Global ({allPerms.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-emerald-800 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-medium">Cargando roles y permisos...</div>
      ) : viewMode === 'catalog' ? (
        /* VISTA: CATÁLOGO GLOBAL */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <input
              type="text"
              placeholder="Buscar en el catálogo de permisos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-md rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
            />
            <span className="text-xs text-slate-400 font-bold">
              Total: {allPerms.length} permisos del sistema
            </span>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedPerms).map(([module, perms]) => {
              const filtered = perms.filter(
                (p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()) ||
                  p.description.toLowerCase().includes(search.toLowerCase())
              );
              if (filtered.length === 0) return null;

              return (
                <div key={module} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <h2 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                    {module}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((p) => (
                      <div key={p.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</p>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex justify-between items-center text-[10px]">
                          <span className="font-mono text-slate-400">ID: {p.id}</span>
                          <span className="font-bold bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                            Asignado a {p.roles_count || 0} rol(es)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA: ASIGNAR Y QUITAR PERMISOS POR ROL */
        <div className="space-y-6">
          {/* Barra de Selección de Rol */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Seleccionar Rol para Configurar
                </label>
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const isSelected = r.id === selectedRoleId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelectRole(r.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-brand text-white border-brand shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span>{r.display_name}</span>
                        {r.id === 1 ? (
                          <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded uppercase">Bypass</span>
                        ) : (
                          <span className="text-[10px] opacity-70">ID: {r.id}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón Guardar en Header */}
              {!isAdminRole && (
                <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={handleSavePermissions}
                    disabled={saving || loadingPerms}
                    className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              )}
            </div>

            {currentRole && (
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2">
                <p>
                  <b>Identificador:</b> <span className="font-mono text-slate-700 dark:text-slate-300">{currentRole.name}</span> • {currentRole.description || 'Sin descripción'}
                </p>
                {!isAdminRole && (
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-brand font-bold">{assignedPerms.size}</span> de {allPerms.length} permisos habilitados
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button onClick={handleSelectAll} className="text-brand hover:underline">Marcar todos</button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button onClick={handleDeselectAll} className="text-rose-500 hover:underline">Desmarcar todos</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Banner si es Rol Administrador */}
          {isAdminRole ? (
            <div className="p-8 text-center bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-2xl space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-sky-900 dark:text-sky-200">
                Super-Administrador: Acceso Global Irrestricto
              </h3>
              <p className="text-sm text-sky-700 dark:text-sky-400 max-w-xl mx-auto">
                El perfil de Administrador cuenta con bypass directo a nivel de middleware en el servidor. Posee acceso total a todos los módulos y operaciones de la plataforma sin restricciones.
              </p>
            </div>
          ) : loadingPerms ? (
            <div className="text-center py-12 text-slate-400 font-medium">Cargando permisos del rol seleccionado...</div>
          ) : (
            /* Lista de Permisos por Módulo */
            <div className="space-y-6">
              {Object.entries(groupedPerms).map(([module, perms]) => {
                const moduleIds = perms.map((p) => p.id);
                const countSelected = moduleIds.filter((id) => assignedPerms.has(id)).length;
                const allSelected = countSelected === perms.length;

                return (
                  <div
                    key={module}
                    className="bg-slate-50/70 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
                  >
                    {/* Header del Módulo con botón Marcar/Desmarcar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                      <div>
                        <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          Módulo: {module}
                        </h2>
                        <p className="text-xs text-slate-400">
                          {countSelected} de {perms.length} permisos habilitados
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleModule(perms)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition border self-start sm:self-center ${
                          allSelected
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
                            : 'bg-white dark:bg-slate-800 text-brand border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {allSelected ? 'Desmarcar Módulo' : 'Marcar Todo el Módulo'}
                      </button>
                    </div>

                    {/* Grid de Permisos con Checkbox */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {perms.map((p) => {
                        const isChecked = assignedPerms.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-brand/5 dark:bg-brand/10 border-brand/50 shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(p.id)}
                              className="mt-0.5 w-4 h-4 text-brand rounded focus:ring-brand accent-brand cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-1">
                                {p.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Botón Guardar Inferior Sticky */}
              <div className="sticky bottom-4 z-20 flex items-center justify-between p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    Configuración de: <span className="text-brand">{currentRole?.display_name}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {assignedPerms.size} permisos seleccionados para este rol
                  </p>
                </div>
                <button
                  onClick={handleSavePermissions}
                  disabled={saving || loadingPerms}
                  className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {saving ? 'Guardando cambios...' : 'Guardar Permisos'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

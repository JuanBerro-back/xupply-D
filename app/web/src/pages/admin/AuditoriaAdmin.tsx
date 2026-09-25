import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';

interface AuditLog {
  id: number;
  user_name: string | null;
  username: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: any | null;
  new_values: any | null;
  ip_address: string;
  created_at: string;
}

export default function AuditoriaAdmin() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtros
  const [entityType, setEntityType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal Detalle
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [entityType, actionFilter, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let url = `/admin/audit-log?page=${page}&limit=20`;
      if (entityType) url += `&entity_type=${entityType}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      
      const res = await api<{data: AuditLog[], meta: any}>(url);
      setLogs(res.data);
      setTotalPages(res.meta.pages);
    } catch (err: any) {
      setError(err.message || 'Error cargando auditoría');
    } finally {
      setLoading(false);
    }
  };

  const formatJSON = (data: any) => {
    if (!data) return 'null';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">Registro de Auditoría</h1>
          <p className="text-sm text-slate-500">Trazabilidad de cambios críticos en el sistema</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
        >
          <option value="">Todas las Entidades</option>
          <option value="user">Usuario</option>
          <option value="role">Rol</option>
          <option value="permission">Permiso</option>
        </select>
        
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
        >
          <option value="">Todas las Acciones</option>
          <option value="create">Creación (create)</option>
          <option value="update">Edición (update)</option>
          <option value="activate">Activación</option>
          <option value="deactivate">Desactivación</option>
          <option value="delete">Eliminación (delete)</option>
          <option value="update_permissions">Asignación de Permisos</option>
          <option value="change_password">Cambio de Contraseña</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-extrabold text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Entidad / ID</th>
              <th className="px-4 py-3 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8">Cargando logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">No se encontraron registros</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900 dark:text-white">{log.user_name || 'Sistema'}</p>
                    {log.username && <p className="text-[10px] text-slate-500">@{log.username}</p>}
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{log.ip_address}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold uppercase text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{log.entity_type}</p>
                    <p className="text-xs text-slate-500">ID: {log.entity_id || 'N/A'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => setSelectedLog(log)} 
                      className="text-xs font-semibold px-3 py-1.5 bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition"
                    >
                      Ver Cambios
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

      {selectedLog && (
        <Modal title="Detalle del Cambio" onClose={() => setSelectedLog(null)} maxWidth="max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
              <h3 className="text-sm font-black text-rose-800 dark:text-rose-400 mb-2 uppercase tracking-wider border-b border-rose-200 dark:border-rose-800/50 pb-2">
                Valores Anteriores
              </h3>
              <pre className="text-xs font-mono text-rose-900 dark:text-rose-200 overflow-x-auto whitespace-pre-wrap">
                {formatJSON(selectedLog.old_values)}
              </pre>
            </div>
            
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-400 mb-2 uppercase tracking-wider border-b border-emerald-200 dark:border-emerald-800/50 pb-2">
                Nuevos Valores
              </h3>
              <pre className="text-xs font-mono text-emerald-900 dark:text-emerald-200 overflow-x-auto whitespace-pre-wrap">
                {formatJSON(selectedLog.new_values)}
              </pre>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setSelectedLog(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700">
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

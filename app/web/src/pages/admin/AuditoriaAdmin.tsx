import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
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
  
  // WebSocket en vivo
  const [socketConnected, setSocketConnected] = useState(false);
  const [liveAlert, setLiveAlert] = useState<string | null>(null);

  // Filtros
  const [entityType, setEntityType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal Detalle
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [entityType, actionFilter, page]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    setSocketConnected(socket.connected);
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    const handleNewEntry = (entry: any) => {
      if (!entry) return;

      // Si estamos en la página 1, anteponemos el nuevo movimiento
      if (page === 1) {
        setLogs((prev) => {
          if (prev.some((l) => l.id === entry.id)) return prev;
          return [entry, ...prev.slice(0, 24)];
        });
      }

      const who = entry.user_name || entry.username || 'Usuario';
      setLiveAlert(`Movimiento detectado: ${who} realizó "${entry.action}" en ${entry.entity_type}`);
      setTimeout(() => setLiveAlert(null), 5000);
    };

    socket.on('audit:new_entry', handleNewEntry);
    socket.on('user:activity', handleNewEntry);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('audit:new_entry', handleNewEntry);
      socket.off('user:activity', handleNewEntry);
    };
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let url = `/admin/audit-log?page=${page}&limit=25`;
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

  const filteredLogs = logs.filter((log) => {
    if (!userQuery) return true;
    const q = userQuery.toLowerCase();
    const nameMatch = log.user_name?.toLowerCase().includes(q);
    const userMatch = log.username?.toLowerCase().includes(q);
    const ipMatch = log.ip_address?.toLowerCase().includes(q);
    return nameMatch || userMatch || ipMatch;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">Registro de Auditoría</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand dark:bg-brand/20">
              Supervisión Global
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitoreo en tiempo real de todos los movimientos y operaciones de cada usuario en el sistema.
          </p>
        </div>

        {/* Estado WebSocket */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
            socketConnected 
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span>{socketConnected ? 'WebSocket en Vivo' : 'Conectando WebSocket...'}</span>
          </div>
        </div>
      </div>

      {/* Banner de nuevo evento en tiempo real */}
      {liveAlert && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>{liveAlert}</span>
          </div>
          <button onClick={() => setLiveAlert(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
            Buscar Usuario / IP
          </label>
          <input
            type="text"
            placeholder="Filtrar por nombre, @usuario o IP..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
            Tipo de Entidad
          </label>
          <select
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
          >
            <option value="">Todas las Entidades</option>
            <option value="user">Usuario</option>
            <option value="role">Rol</option>
            <option value="permission">Permiso</option>
            <option value="order">Pedido</option>
            <option value="invoice">Factura</option>
            <option value="restaurant">Restaurante</option>
            <option value="supplier">Proveedor</option>
            <option value="branch">Sucursal</option>
            <option value="radar_alert">Alerta Radar</option>
            <option value="radar_offer">Oferta Radar</option>
          </select>
        </div>
        
        <div>
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
            Tipo de Acción
          </label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
          >
            <option value="">Todas las Acciones</option>
            <option value="login">Inicio de Sesión (login)</option>
            <option value="register">Registro (register)</option>
            <option value="create">Creación (create)</option>
            <option value="update">Edición (update)</option>
            <option value="update_status">Cambio de Estado</option>
            <option value="activate">Activación</option>
            <option value="deactivate">Desactivación</option>
            <option value="delete">Eliminación (delete)</option>
            <option value="update_permissions">Asignación de Permisos</option>
            <option value="change_password">Cambio de Contraseña</option>
            <option value="force_logout">Cierre Forzado de Sesión</option>
            <option value="offer">Oferta Radar</option>
            <option value="accept_offer">Aceptación Oferta</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-extrabold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3">Fecha y Hora</th>
              <th className="px-4 py-3">Usuario Responsable</th>
              <th className="px-4 py-3">Acción Registrada</th>
              <th className="px-4 py-3">Módulo / Entidad</th>
              <th className="px-4 py-3 text-right">Auditar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Cargando logs de auditoría...</td></tr>
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">No se encontraron registros coincidentes</td></tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    <p className="font-semibold text-slate-900 dark:text-slate-200">
                      {new Date(log.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(log.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900 dark:text-white">{log.user_name || 'Sistema'}</p>
                    {log.username && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">@{log.username}</p>}
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{log.ip_address}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold uppercase text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{log.entity_type}</p>
                    <p className="text-xs text-slate-500 font-mono">ID: {log.entity_id ?? 'N/A'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => setSelectedLog(log)} 
                      className="text-xs font-semibold px-3 py-1.5 bg-brand/10 text-brand hover:bg-brand/20 dark:bg-brand/20 dark:text-sky-300 rounded-lg transition"
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
        <div className="flex justify-center items-center gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm font-bold text-slate-700 dark:text-slate-300">
            Página {page} de {totalPages}
          </span>
          <button 
            disabled={page === totalPages} 
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal Detalle de Cambio */}
      {selectedLog && (
        <Modal title={`Detalle del Movimiento #${selectedLog.id}`} onClose={() => setSelectedLog(null)} maxWidth="max-w-4xl">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs">
              <div>
                <span className="text-slate-400">Responsable: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLog.user_name || 'Sistema'} (@{selectedLog.username || 'sistema'})</span>
              </div>
              <div>
                <span className="text-slate-400">Acción: </span>
                <span className="font-bold text-brand uppercase">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-slate-400">IP: </span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{selectedLog.ip_address}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4">
                <h3 className="text-xs font-black text-rose-800 dark:text-rose-400 mb-2 uppercase tracking-wider border-b border-rose-200 dark:border-rose-900/50 pb-2">
                  Valores Anteriores (Pre-Estado)
                </h3>
                <pre className="text-xs font-mono text-rose-950 dark:text-rose-200 overflow-x-auto whitespace-pre-wrap max-h-72">
                  {formatJSON(selectedLog.old_values)}
                </pre>
              </div>
              
              <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4">
                <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-400 mb-2 uppercase tracking-wider border-b border-emerald-200 dark:border-emerald-900/50 pb-2">
                  Nuevos Valores (Post-Estado)
                </h3>
                <pre className="text-xs font-mono text-emerald-950 dark:text-emerald-200 overflow-x-auto whitespace-pre-wrap max-h-72">
                  {formatJSON(selectedLog.new_values)}
                </pre>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)} 
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

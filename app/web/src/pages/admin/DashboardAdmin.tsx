import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { IconDocument, IconTeam } from '../../components/Icons';

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

export default function DashboardAdmin() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    loadStats(dateRange);
  }, [dateRange]);

  const loadStats = async (range: string) => {
    try {
      setLoading(true);
      const data = await api(`/admin/stats?date_range=${range}`);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!stats && loading) return <div className="p-8 text-center text-slate-500">Cargando métricas...</div>;
  if (!stats) return <div className="p-8 text-center text-rose-500">Error cargando métricas</div>;

  const formatCurrency = (val: number) => '$ ' + Math.floor(val).toLocaleString('es-CO');
  const maxSales = stats.sales_by_day?.reduce((max: number, d: any) => Math.max(max, Number(d.total)), 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Dashboard Ejecutivo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visión global de negocio</p>
        </div>
        <select 
          value={dateRange} 
          onChange={e => setDateRange(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-xl px-4 py-2 font-bold focus:ring-2 focus:ring-brand outline-none"
        >
          <option value="hoy">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
        </select>
      </div>

      {/* Tarjetas de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.kpis?.revenue || 0)}</p>
          <p className="text-xs text-slate-400 mt-1">Facturado en el periodo</p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">GMV</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stats.kpis?.gmv_total || 0)}</p>
          <p className="text-xs text-slate-400 mt-1">Volumen de ventas total</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Pedidos Totales</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.kpis?.orders_count || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Ticket Promedio: {formatCurrency(stats.kpis?.avg_ticket || 0)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Entregas Fallidas</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {Number(stats.kpis?.failed_delivery_pct || 0).toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 mt-1">Retraso prom: {Number(stats.kpis?.avg_delivery_delay_min || 0).toFixed(0)} min</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Ventas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Ventas por Día</h2>
          {stats.sales_by_day?.length > 0 ? (
            <div className="h-48 flex items-end gap-2 overflow-x-auto pb-2">
              {stats.sales_by_day.map((day: any) => {
                const height = Math.max((Number(day.total) / maxSales) * 160, 4);
                return (
                  <div key={day.date} className="h-full flex flex-col items-center justify-end gap-2 min-w-[30px] flex-1 group">
                    <div 
                      className="w-full bg-brand/20 group-hover:bg-brand transition-colors rounded-t-sm"
                      style={{ height: `${height}px` }}
                      title={`${new Date(day.date).toLocaleDateString('es-CO')}: ${formatCurrency(Number(day.total))}`}
                    />
                    <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
             <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No hay ventas en este periodo</div>
          )}
        </div>

        {/* Resumen de Inventario y Operación */}
        <div className="space-y-4">
          <div className="bg-rose-50 dark:bg-rose-900/10 rounded-2xl shadow-sm border border-rose-100 dark:border-rose-900/30 p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <IconAlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Inventario Crítico</p>
              <p className="text-2xl font-black text-rose-600">{stats.kpis?.critical_items || 0} ítems</p>
            </div>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-900/30 p-5 flex items-center gap-4">
             <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <IconDocument className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Por Vencer (7d)</p>
              <p className="text-2xl font-black text-amber-600">{stats.kpis?.expiring_items || 0} ítems</p>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/30 p-5 flex items-center gap-4">
             <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <IconTeam className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Proveedores Activos</p>
              <p className="text-2xl font-black text-blue-600">{stats.kpis?.active_suppliers || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Productos */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Top Productos</h2>
          <div className="space-y-3">
            {stats.top_products?.length > 0 ? stats.top_products.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{p.name}</span>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{Number(p.qty).toLocaleString('es-CO')} u.</p>
                  <p className="text-xs text-slate-500 font-mono">{formatCurrency(p.total)}</p>
                </div>
              </div>
            )) : <p className="text-sm text-slate-400">No hay datos</p>}
          </div>
        </div>

        {/* Top Proveedores */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Top Proveedores</h2>
          <div className="space-y-3">
            {stats.top_suppliers?.length > 0 ? stats.top_suppliers.map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{s.name}</span>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(s.total)}</p>
                  <p className="text-xs text-slate-500 font-mono">{s.orders} pedidos</p>
                </div>
              </div>
            )) : <p className="text-sm text-slate-400">No hay datos</p>}
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <IconTrendingUp className="w-5 h-5 text-slate-400" /> Actividad Reciente
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                <th className="py-3 font-semibold">Fecha</th>
                <th className="py-3 font-semibold">Usuario</th>
                <th className="py-3 font-semibold">Acción</th>
                <th className="py-3 font-semibold">Entidad</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.recent_activity?.map((act: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="py-3 text-slate-500 font-mono whitespace-nowrap">
                    {new Date(act.created_at).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">{act.user_name || 'Sistema'}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-400">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs font-mono">{act.action}</span>
                  </td>
                  <td className="py-3 text-slate-500">{act.entity_type}</td>
                </tr>
              ))}
              {(!stats.recent_activity || stats.recent_activity.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">No hay actividad reciente</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

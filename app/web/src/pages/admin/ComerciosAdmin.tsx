import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { IconSuppliers, IconTeam, IconDocument, IconDashboard } from '../../components/Icons';

function IconRestaurant({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V10l-7-4-7 4v11h4v-6h6v6h4z" />
    </svg>
  );
}

export default function ComerciosAdmin() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'restaurantes' | 'proveedores'>('restaurantes');
  const [selectedCommerce, setSelectedCommerce] = useState<{type: 'restaurant' | 'supplier', id: number} | null>(null);
  
  // Detalle
  const [detailData, setDetailData] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'branches' | 'users' | 'catalog'>('info');

  // Modals
  const [showModal, setShowModal] = useState<string | null>(null); // 'restaurant', 'supplier', 'branch'
  const [editItem, setEditItem] = useState<any>(null);
  const [branchRestaurantId, setBranchRestaurantId] = useState<number | null>(null);

  useEffect(() => {
    fetchComercios();
  }, []);

  useEffect(() => {
    if (selectedCommerce) {
      fetchDetail();
    }
  }, [selectedCommerce]);

  const fetchComercios = async () => {
    setLoading(true);
    try {
      const [restRes, suppRes] = await Promise.all([
        api<any[]>('/admin/restaurants'),
        api<any[]>('/admin/suppliers'),
      ]);
      setRestaurants(restRes);
      setSuppliers(suppRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async () => {
    if (!selectedCommerce) return;
    try {
      const res = await api(`/admin/comercios/${selectedCommerce.type}/${selectedCommerce.id}`);
      setDetailData(res);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  const toggleStatus = async (type: 'restaurants' | 'suppliers' | 'branches', id: number, isActive: boolean) => {
    try {
      await api(`/admin/${type}/${id}/${isActive ? 'deactivate' : 'activate'}`, { method: 'PATCH' });
      fetchComercios();
      if (selectedCommerce) fetchDetail();
    } catch (err) {
      console.error(err);
      alert('Error cambiando estado');
    }
  };

  const handleSave = async (e: any, type: string) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    
    try {
      if (editItem?.id) {
        await api(`/admin/${type}/${editItem.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api(`/admin/${type}`, { method: 'POST', body: JSON.stringify(body) });
      }
      setShowModal(null);
      setEditItem(null);
      fetchComercios();
      if (selectedCommerce) fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Error guardando');
    }
  };

  // --- RENDERS ---

  if (selectedCommerce && detailData) {
    const profile = detailData.profile;
    const isRest = selectedCommerce.type === 'restaurant';
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedCommerce(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white">{profile.name}</h1>
              <p className="text-sm text-slate-500">NIT: {profile.nit} | {isRest ? 'Restaurante' : 'Proveedor'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <select 
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none"
              value={`${selectedCommerce.type}-${selectedCommerce.id}`}
              onChange={(e) => {
                const [t, i] = e.target.value.split('-');
                setSelectedCommerce({ type: t as any, id: Number(i) });
              }}
            >
              <optgroup label="Restaurantes">
                {restaurants.map(r => <option key={`r-${r.id}`} value={`restaurant-${r.id}`}>{r.name}</option>)}
              </optgroup>
              <optgroup label="Proveedores">
                {suppliers.map(s => <option key={`s-${s.id}`} value={`supplier-${s.id}`}>{s.name}</option>)}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Métricas Globales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Pedidos Totales</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{detailData.metrics?.total_orders || 0}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Volumen Operado</p>
            <p className="text-2xl font-black text-brand">$ {Number(detailData.metrics?.gmv || 0).toLocaleString('es-CO')}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Usuarios</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{detailData.users?.length || 0}</p>
          </div>
          {isRest && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Sucursales</p>
              <p className="text-2xl font-black text-slate-800 dark:text-white">{detailData.branches?.length || 0}</p>
            </div>
          )}
        </div>

        {/* Tabs Detalle */}
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {['info', 'catalog', 'users', ...(isRest ? ['branches'] : [])].map(t => (
            <button
              key={t}
              onClick={() => setDetailTab(t as any)}
              className={`pb-2 px-1 font-bold text-sm uppercase ${detailTab === t ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              {t === 'info' ? 'Info General' : t === 'catalog' ? (isRest ? 'Menú' : 'Productos') : t === 'users' ? 'Usuarios' : 'Sucursales'}
            </button>
          ))}
        </div>

        {/* Contenido Tabs */}
        {detailTab === 'info' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
             <div className="grid grid-cols-2 gap-4">
               <div><p className="text-sm text-slate-500">Email</p><p className="font-semibold text-slate-800 dark:text-white">{profile.email || '-'}</p></div>
               <div><p className="text-sm text-slate-500">Teléfono</p><p className="font-semibold text-slate-800 dark:text-white">{profile.phone || '-'}</p></div>
               <div><p className="text-sm text-slate-500">Dirección</p><p className="font-semibold text-slate-800 dark:text-white">{profile.address || '-'} {profile.city ? `, ${profile.city}` : ''}</p></div>
               <div><p className="text-sm text-slate-500">Categoría</p><p className="font-semibold text-slate-800 dark:text-white">{profile.category || '-'}</p></div>
             </div>
          </div>
        )}

        {detailTab === 'branches' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Sucursales</h3>
              <button onClick={() => { setBranchRestaurantId(profile.id); setEditItem(null); setShowModal('branches'); }} className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-bold">Nueva Sucursal</button>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-800">
                <tr><th>Nombre</th><th>Dirección</th><th>Teléfono</th><th>Principal</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {detailData.branches?.map((b: any) => (
                  <tr key={b.id} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-2">{b.name}</td>
                    <td>{b.address}</td>
                    <td>{b.phone}</td>
                    <td>{b.is_main ? 'Sí' : 'No'}</td>
                    <td>{b.is_active ? 'Activa' : 'Inactiva'}</td>
                    <td>
                      <button onClick={() => { setEditItem(b); setShowModal('branches'); }} className="text-blue-500 hover:underline text-xs mr-2">Editar</button>
                      <button onClick={() => toggleStatus('branches', b.id, b.is_active)} className="text-orange-500 hover:underline text-xs">Alternar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {detailTab === 'catalog' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 overflow-x-auto">
            <h3 className="font-bold mb-4">{isRest ? 'Menú' : 'Productos'}</h3>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-slate-100 dark:border-slate-800">
                <tr><th>Nombre</th><th>Categoría</th><th>Precio</th>{isRest ? null : <th>Stock</th>}<th>Unidad</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {detailData.catalog?.map((c: any) => (
                  <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-2">{c.name}</td>
                    <td>{c.category_name || c.category || '-'}</td>
                    <td>$ {Number(c.price_per_unit || c.price || 0).toLocaleString('es-CO')}</td>
                    {isRest ? null : <td>{c.stock_available}</td>}
                    <td>{c.unit || '-'}</td>
                    <td>{c.is_active ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detailTab === 'users' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 overflow-x-auto">
            <h3 className="font-bold mb-4">Usuarios</h3>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-slate-100 dark:border-slate-800">
                <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Último Acceso</th></tr>
              </thead>
              <tbody>
                {detailData.users?.map((u: any) => (
                  <tr key={u.id} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-2">{u.name}</td>
                    <td>{u.email || '-'}</td>
                    <td>{u.role}</td>
                    <td>{u.is_active ? 'Activo' : 'Inactivo'}</td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString('es-CO') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal genérico para sucursal */}
        {showModal === 'branches' && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <form onSubmit={(e) => handleSave(e, 'branches')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-md space-y-4">
              <h2 className="text-xl font-bold">{editItem?.id ? 'Editar Sucursal' : 'Nueva Sucursal'}</h2>
              <input type="hidden" name="restaurant_id" value={editItem?.restaurant_id || branchRestaurantId} />
              <div><label className="block text-sm mb-1">Nombre</label><input required name="name" defaultValue={editItem?.name} className="w-full border rounded p-2 text-slate-900" /></div>
              <div><label className="block text-sm mb-1">Dirección</label><input name="address" defaultValue={editItem?.address} className="w-full border rounded p-2 text-slate-900" /></div>
              <div><label className="block text-sm mb-1">Teléfono</label><input name="phone" defaultValue={editItem?.phone} className="w-full border rounded p-2 text-slate-900" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_main" defaultChecked={editItem?.is_main} id="is_main" value="true" />
                <label htmlFor="is_main" className="text-sm">Es Sede Principal</label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => { setShowModal(null); setEditItem(null); }} className="px-4 py-2 bg-slate-200 text-slate-800 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand text-white rounded font-bold">Guardar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // --- VISTA LISTA MAESTRA ---
  const list = activeTab === 'restaurantes' ? restaurants : suppliers;
  const currentEntityStr = activeTab === 'restaurantes' ? 'restaurants' : 'suppliers';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Directorio de Comercios</h1>
          <p className="text-sm text-slate-500">Administra restaurantes, proveedores y sucursales.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadCSV(list, activeTab)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition">
            Exportar CSV
          </button>
          <button onClick={() => { setEditItem(null); setShowModal(currentEntityStr); }} className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold shadow-sm hover:bg-brand/90 transition">
            + Nuevo {activeTab === 'restaurantes' ? 'Restaurante' : 'Proveedor'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          className={`pb-2 px-1 font-bold text-sm ${activeTab === 'restaurantes' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('restaurantes')}
        >
          <span className="flex items-center gap-2"><IconRestaurant className="w-4 h-4" /> Restaurantes ({restaurants.length})</span>
        </button>
        <button
          className={`pb-2 px-1 font-bold text-sm ${activeTab === 'proveedores' ? 'border-b-2 border-emerald-500 text-emerald-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('proveedores')}
        >
          <span className="flex items-center gap-2"><IconSuppliers className="w-4 h-4" /> Proveedores ({suppliers.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Cargando comercios...</div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                <th className="py-3 px-4 font-semibold">Nombre</th>
                <th className="py-3 px-4 font-semibold">NIT</th>
                <th className="py-3 px-4 font-semibold">Contacto</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
                <th className="py-3 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {list.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs ${activeTab === 'restaurantes' ? 'bg-brand' : 'bg-emerald-500'}`}>
                         {c.name.charAt(0)}
                       </div>
                       {c.name}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono">{c.nit || '-'}</td>
                  <td className="py-3 px-4 text-slate-500">{c.phone || c.email || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400'}`}>
                      {c.is_active ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-3">
                    <button onClick={() => setSelectedCommerce({ type: activeTab === 'restaurantes' ? 'restaurant' : 'supplier', id: c.id })} className="text-brand hover:underline font-semibold">Ver</button>
                    <button onClick={() => { setEditItem(c); setShowModal(currentEntityStr); }} className="text-blue-500 hover:underline">Editar</button>
                    <button onClick={() => toggleStatus(currentEntityStr, c.id, c.is_active)} className="text-orange-500 hover:underline">
                       {c.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">No hay registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear/Editar Restaurante/Proveedor */}
      {(showModal === 'restaurants' || showModal === 'suppliers') && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={(e) => handleSave(e, showModal)} className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold dark:text-white">
              {editItem ? 'Editar' : 'Nuevo'} {showModal === 'restaurants' ? 'Restaurante' : 'Proveedor'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Nombre *</label>
                <input required name="name" defaultValue={editItem?.name} className="w-full border dark:border-slate-700 bg-transparent rounded p-2 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">NIT *</label>
                <input required name="nit" defaultValue={editItem?.nit} className="w-full border dark:border-slate-700 bg-transparent rounded p-2 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Categoría</label>
                <input name="category" defaultValue={editItem?.category} className="w-full border dark:border-slate-700 bg-transparent rounded p-2 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Teléfono</label>
                <input name="phone" defaultValue={editItem?.phone} className="w-full border dark:border-slate-700 bg-transparent rounded p-2 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Email</label>
                <input type="email" name="email" defaultValue={editItem?.email} className="w-full border dark:border-slate-700 bg-transparent rounded p-2 text-slate-900 dark:text-white" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Dirección</label>
                <input name="address" defaultValue={editItem?.address} className="w-full border dark:border-slate-700 bg-transparent rounded p-2 text-slate-900 dark:text-white" />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => { setShowModal(null); setEditItem(null); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-semibold">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-brand text-white rounded font-bold">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

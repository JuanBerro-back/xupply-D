import { useEffect, useState, FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { Product, Category, Supplier } from '../types';
import Modal from '../components/Modal';

interface ProductForm {
  name: string;
  category_id: string;
  description: string;
  unit: string;
  price_per_unit: string;
  min_order_qty: string;
  stock_available: string;
}

const emptyForm: ProductForm = {
  name: '',
  category_id: '',
  description: '',
  unit: 'kg',
  price_per_unit: '',
  min_order_qty: '1',
  stock_available: '0',
};

export default function Catalog() {
  const { user } = useAuth();
  const { add } = useCart();
  const { push } = useNotifications();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [linkedSupplierIds, setLinkedSupplierIds] = useState<number[]>([]);

  const isSupplier = user?.role === 'proveedor_admin';

  const load = () => {
    const qs = new URLSearchParams();
    if (supplierFilter) qs.set('supplier_id', String(supplierFilter));
    if (categoryFilter) qs.set('category_id', String(categoryFilter));
    if (search) qs.set('search', search);
    api<Product[]>(`/products?${qs.toString()}`).then(setProducts).catch(console.error);
  };

  useEffect(() => {
    api<Category[]>('/categories').then(setCategories).catch(console.error);
    api<Supplier[]>('/suppliers').then(setSuppliers).catch(console.error);

    const updateLinked = () => {
      const stored = localStorage.getItem('xupply_linked_suppliers');
      if (stored) {
        try {
          setLinkedSupplierIds(JSON.parse(stored));
        } catch (e) {}
      }
    };
    updateLinked();
    window.addEventListener('xupply_linked_suppliers_changed', updateLinked);
    return () => window.removeEventListener('xupply_linked_suppliers_changed', updateLinked);
  }, []);

  useEffect(load, [supplierFilter, categoryFilter, search]);

  const displayedProducts = isSupplier 
    ? products 
    : products.filter(p => p.supplier_id && linkedSupplierIds.includes(p.supplier_id));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category_id: String(p.category_id ?? ''),
      description: p.description ?? '',
      unit: p.unit,
      price_per_unit: String(p.price_per_unit),
      min_order_qty: String(p.min_order_qty),
      stock_available: String(p.stock_available),
    });
    setModal(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      category_id: form.category_id ? Number(form.category_id) : null,
      description: form.description,
      unit: form.unit,
      price_per_unit: Number(form.price_per_unit),
      min_order_qty: Number(form.min_order_qty),
      stock_available: Number(form.stock_available),
    };
    try {
      await api(
        editing ? `/products/${editing.id}` : '/products',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );
      push({ message: `Producto ${editing ? 'actualizado' : 'creado'}`, at: new Date().toISOString() });
      setModal(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const removeProduct = async (id: number) => {
    try {
      await api(`/products/${id}`, { method: 'DELETE' });
      push({ message: 'Producto desactivado', at: new Date().toISOString() });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const set = (k: keyof ProductForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const input = 'w-full rounded border px-3 py-2';
  const label = 'mb-1 block text-sm font-medium';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isSupplier && (
          <button onClick={openCreate} className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            + Nuevo producto
          </button>
        )}
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value ? Number(e.target.value) : '')} className="rounded border px-3 py-2">
          <option value="">Todos los proveedores</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : '')} className="rounded border px-3 py-2">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="flex-1 rounded border px-3 py-2" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayedProducts.map((p) => (
          <div key={p.id} className="flex flex-col rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="font-semibold">{p.name}</h3>
              <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{p.category}</span>
            </div>
            <p className="mb-2 text-xs text-gray-500">{p.supplier_name}</p>
            <p className="mb-1 text-xs text-gray-600">Disp: {p.stock_available} {p.unit} · Min: {p.min_order_qty}</p>
            <p className="mb-3 text-lg font-bold text-brand">
              {p.price_per_unit.toLocaleString('es-CO')} / {p.unit}
            </p>
            {isSupplier ? (
              <div className="mt-auto flex gap-2">
                <button onClick={() => openEdit(p)} className="flex-1 rounded border border-brand py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white">
                  Editar
                </button>
                <button onClick={() => removeProduct(p.id)} className="flex-1 rounded border border-red-500 py-2 text-sm font-medium text-red-500 hover:bg-red-500 hover:text-white">
                  Desactivar
                </button>
              </div>
            ) : user?.role === 'gerente' || user?.role === 'restaurante_admin' ? (
              <button onClick={() => add(p, Math.max(p.min_order_qty, 1))} className="mt-auto rounded bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Agregar al carrito
              </button>
            ) : (
              <div className="mt-auto py-2 text-center text-xs text-slate-500 font-bold bg-slate-100 rounded">
                Solo los gerentes pueden comprar
              </div>
            )}
          </div>
        ))}
        {displayedProducts.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <p className="text-slate-500 font-medium mb-4">No hay productos disponibles.</p>
            {!isSupplier && linkedSupplierIds.length === 0 && (
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Aún no has vinculado a ningún proveedor. Ve a la pestaña <a href="/proveedores" className="text-brand font-bold hover:underline">Directorio (Proveedores)</a> para empezar a construir tu mercado.
              </p>
            )}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editing ? `Editar ${editing.name}` : 'Nuevo producto'} onClose={() => setModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className={label}>Nombre</label>
              <input value={form.name} onChange={set('name')} className={input} required />
            </div>
            <div>
              <label className={label}>Categoría</label>
              <select value={form.category_id} onChange={set('category_id')} className={input}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Descripción</label>
              <textarea value={form.description} onChange={set('description')} className={input} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Precio por unidad</label>
                <input type="number" step="0.01" min="0" value={form.price_per_unit} onChange={set('price_per_unit')} className={input} required />
              </div>
              <div>
                <label className={label}>Unidad</label>
                <select value={form.unit} onChange={set('unit')} className={input}>
                  <option value="kg">kg</option>
                  <option value="libra">libra</option>
                  <option value="unidad">unidad</option>
                  <option value="litro">litro</option>
                </select>
              </div>
              <div>
                <label className={label}>Cantidad mínima</label>
                <input type="number" step="0.01" min="0" value={form.min_order_qty} onChange={set('min_order_qty')} className={input} />
              </div>
              <div>
                <label className={label}>Stock disponible</label>
                <input type="number" step="0.01" min="0" value={form.stock_available} onChange={set('stock_available')} className={input} />
              </div>
            </div>
            <button className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark">
              {editing ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
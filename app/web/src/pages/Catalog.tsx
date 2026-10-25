import { toast } from '../lib/feedback';
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
  supplier_id: string;
  description: string;
  unit: string;
  price_per_unit: string;
  min_order_qty: string;
  stock_available: string;
  image_url: string;
}

const emptyForm: ProductForm = {
  name: '',
  category_id: '',
  supplier_id: '',
  description: '',
  unit: 'kg',
  price_per_unit: '',
  min_order_qty: '1',
  stock_available: '0',
  image_url: '',
};

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  Carnes: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
  Pollo: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
  Cerdo: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  Mariscos: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80',
  Lacteos: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
  'Lácteos': 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
  Verduras: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
  Frutas: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=600&q=80',
  Bebidas: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
  Granos: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  Condimentos: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
};

export function getProductImage(product: Product): string {
  if (product.image_url && product.image_url.trim().startsWith('http')) {
    return product.image_url.trim();
  }
  const cat = (product.category || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  for (const [key, url] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (cat.includes(key.toLowerCase()) || name.includes(key.toLowerCase())) {
      return url;
    }
  }
  if (name.includes('res') || name.includes('carne') || name.includes('lomo') || name.includes('costilla')) {
    return CATEGORY_FALLBACK_IMAGES.Carnes;
  }
  if (name.includes('pollo') || name.includes('pechuga') || name.includes('muslo')) {
    return CATEGORY_FALLBACK_IMAGES.Pollo;
  }
  if (name.includes('chicharron') || name.includes('cerdo')) {
    return CATEGORY_FALLBACK_IMAGES.Cerdo;
  }
  if (name.includes('queso') || name.includes('leche') || name.includes('mantequilla')) {
    return CATEGORY_FALLBACK_IMAGES.Lacteos;
  }
  if (name.includes('camaron') || name.includes('pescado') || name.includes('atun')) {
    return CATEGORY_FALLBACK_IMAGES.Mariscos;
  }
  if (name.includes('tomate') || name.includes('cebolla') || name.includes('pimenton') || name.includes('papa')) {
    return CATEGORY_FALLBACK_IMAGES.Verduras;
  }
  if (name.includes('agua') || name.includes('gaseosa') || name.includes('jugo') || name.includes('bebida')) {
    return CATEGORY_FALLBACK_IMAGES.Bebidas;
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
}

interface CustomizationConfig {
  typeLabel: string;
  typeOptions: string[];
  packLabel: string;
  packOptions: string[];
  notesPlaceholder: string;
}

export function getProductCustomizationConfig(product: Product): CustomizationConfig {
  const cat = (product.category || '').toLowerCase();
  const name = (product.name || '').toLowerCase();

  // Bebidas, Jugos, Aguas, Gaseosas
  if (
    cat.includes('bebida') ||
    cat.includes('jugo') ||
    name.includes('jugo') ||
    name.includes('agua') ||
    name.includes('gaseosa') ||
    name.includes('bebida') ||
    name.includes('cerveza') ||
    name.includes('refresco')
  ) {
    return {
      typeLabel: 'Presentación y temperatura:',
      typeOptions: [
        'Refrigerado / Frío',
        'Temperatura ambiente',
        'Sin azúcar añadida',
        'Pulpa natural 100%',
        'Concentrado para diluir',
        'Listo para servir',
      ],
      packLabel: 'Tipo de empaque requerido:',
      packOptions: [
        'Botella individual',
        'Galón institucional',
        'Caja máster / Paca',
        'Canastilla plástica retornable',
        'Bolsa pouch hermética',
      ],
      notesPlaceholder: 'Ej. Servir frío, pulpa sin colar, empacar en pacas de 6 unidades...',
    };
  }

  // Lácteos, Quesos, Leches, Yogures
  if (
    cat.includes('lacteo') ||
    cat.includes('lácteo') ||
    name.includes('queso') ||
    name.includes('leche') ||
    name.includes('mantequilla') ||
    name.includes('yogurt') ||
    name.includes('crema')
  ) {
    return {
      typeLabel: 'Presentación y maduración:',
      typeOptions: [
        'Bloque entero',
        'Tajado / Laminado',
        'Rallado fino',
        'Porcionado x 500g',
        'Maduración óptima',
        'Refrigerado estricto',
      ],
      packLabel: 'Tipo de empaque requerido:',
      packOptions: [
        'Sellado al vacío',
        'Bolsa hermética',
        'Canastilla plástica',
        'Caja térmica con hielo',
        'Empaque estándar',
      ],
      notesPlaceholder: 'Ej. Separar tajadas con papel film, lote con más de 15 días de vencimiento...',
    };
  }

  // Verduras, Frutas, Hortalizas
  if (
    cat.includes('verdura') ||
    cat.includes('fruta') ||
    name.includes('tomate') ||
    name.includes('cebolla') ||
    name.includes('papa') ||
    name.includes('pimenton') ||
    name.includes('limon') ||
    name.includes('aguacate') ||
    name.includes('platano') ||
    name.includes('lechuga')
  ) {
    return {
      typeLabel: 'Selección y maduración:',
      typeOptions: [
        'Maduro (consumo inmediato)',
        'Pintón / Firme (rotación 3-5 días)',
        'Verde para conservar',
        'Lavado y desinfectado',
        'Pelado y picado',
        'Selección primera calidad',
      ],
      packLabel: 'Tipo de empaque requerido:',
      packOptions: [
        'Canastilla plástica',
        'Bolsas perforadas respirables',
        'Caja de cartón ventilada',
        'Malla protectora',
        'Empaque estándar',
      ],
      notesPlaceholder: 'Ej. Aguacates listos para usar en 2 días, tomates calibre mediano parejos...',
    };
  }

  // Granos, Abarrotes, Condimentos
  if (
    cat.includes('grano') ||
    cat.includes('condimento') ||
    name.includes('arroz') ||
    name.includes('frijol') ||
    name.includes('lenteja') ||
    name.includes('aceite') ||
    name.includes('sal') ||
    name.includes('azucar') ||
    name.includes('harina')
  ) {
    return {
      typeLabel: 'Presentación y granulometría:',
      typeOptions: [
        'Grano entero seleccionado',
        'Molido fino',
        'Bolsa sellada de 1kg',
        'Saco 25kg institucional',
        'Limpieza y secado óptimo',
      ],
      packLabel: 'Tipo de empaque requerido:',
      packOptions: [
        'Saco de polipropileno',
        'Bolsa plástica sellada',
        'Caja máster',
        'Empaque al vacío',
        'Empaque estándar',
      ],
      notesPlaceholder: 'Ej. Bultos limpios y secos, estibados para fácil descargue...',
    };
  }

  // Por defecto: Carnes, Pollo, Cerdo, Pescados, Mariscos
  return {
    typeLabel: 'Tipo de corte o preparación:',
    typeOptions: [
      'Corte grueso (2cm)',
      'Corte fino / mariposa',
      'Molido fino',
      'Porcionado individual',
      'Entero sin cortar',
      'Deshuesado / Limpio',
    ],
    packLabel: 'Tipo de empaque requerido:',
    packOptions: [
      'Sellado al vacío',
      'Bandeja con film',
      'Caja térmica con hielo',
      'Bolsas selladas de 1kg',
      'Empaque estándar',
    ],
    notesPlaceholder: 'Ej. Porcionar en paquetes de 2kg y etiquetar con fecha de entrega...',
  };
}

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
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | ''>('');

  // Cantidades interactivas por producto
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  // Modal de personalización de pedido
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [customCorte, setCustomCorte] = useState<string>('');
  const [customEmpaque, setCustomEmpaque] = useState<string>('Sellado al vacío');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [customQty, setCustomQty] = useState<number>(1);

  const isSupplier = user?.role === 'proveedor_admin' || user?.role === 'admin';

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

  const filteredProducts = isSupplier 
    ? products 
    : products.filter(p => p.supplier_id && linkedSupplierIds.includes(p.supplier_id));

  const displayedProducts = [...filteredProducts].sort((a, b) => {
    if (priceSort === 'asc') return a.price_per_unit - b.price_per_unit;
    if (priceSort === 'desc') return b.price_per_unit - a.price_per_unit;
    return 0;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      supplier_id: user?.supplier_id ? String(user.supplier_id) : (suppliers[0]?.id ? String(suppliers[0].id) : ''),
    });
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category_id: String(p.category_id ?? ''),
      supplier_id: String(p.supplier_id ?? user?.supplier_id ?? ''),
      description: p.description ?? '',
      unit: p.unit,
      price_per_unit: String(p.price_per_unit),
      min_order_qty: String(p.min_order_qty),
      stock_available: String(p.stock_available),
      image_url: p.image_url ?? '',
    });
    setModal(true);
  };

  const openCustomization = (p: Product) => {
    const cfg = getProductCustomizationConfig(p);
    setCustomizingProduct(p);
    const initialQty = quantities[p.id] || Math.max(p.min_order_qty || 1, 1);
    setCustomQty(initialQty);
    setCustomCorte(cfg.typeOptions[0] || '');
    setCustomEmpaque(cfg.packOptions[0] || 'Empaque estándar');
    setCustomNotes('');
  };

  const handleAddCustomized = () => {
    if (!customizingProduct) return;
    const parts = [
      customCorte ? customCorte : '',
      customEmpaque ? `Empaque: ${customEmpaque}` : '',
      customNotes ? customNotes.trim() : ''
    ].filter(Boolean);
    const fullCustomization = parts.join(' • ');
    add(customizingProduct, customQty, fullCustomization || undefined);
    push({
      message: `¡${customizingProduct.name} personalizado agregado al carrito!`,
      at: new Date().toISOString()
    });
    setCustomizingProduct(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : (user?.supplier_id || (suppliers[0]?.id ? Number(suppliers[0].id) : undefined)),
      category_id: form.category_id ? Number(form.category_id) : null,
      description: form.description,
      unit: form.unit,
      price_per_unit: Number(form.price_per_unit),
      min_order_qty: Number(form.min_order_qty),
      stock_available: Number(form.stock_available),
      image_url: form.image_url ? form.image_url.trim() : null,
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
      toast((err as Error).message, 'error');
    }
  };

  const removeProduct = async (id: number) => {
    try {
      await api(`/products/${id}`, { method: 'DELETE' });
      push({ message: 'Producto desactivado', at: new Date().toISOString() });
      load();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const set = (k: keyof ProductForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const input = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-brand focus:outline-none';
  const label = 'mb-1 block text-sm font-semibold text-slate-300';

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
        <select value={priceSort} onChange={(e) => setPriceSort(e.target.value as any)} className="rounded border px-3 py-2">
          <option value="">Ordenar por precio</option>
          <option value="desc">Mayor a menor</option>
          <option value="asc">Menor a mayor</option>
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="flex-1 rounded border px-3 py-2" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {displayedProducts.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm hover:shadow-xl dark:shadow-none hover:border-brand/50 transition-all duration-300 overflow-hidden"
          >
            {/* Product Image Banner */}
            <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
              <img
                src={getProductImage(p)}
                alt={p.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = CATEGORY_FALLBACK_IMAGES.Carnes;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
              
              {/* Category Badge */}
              <span className="absolute top-3 left-3 rounded-full bg-slate-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-orange-400 border border-orange-500/30 shadow-sm">
                {p.category || 'General'}
              </span>

              {/* Stock Badge */}
              <span className="absolute top-3 right-3 rounded-full bg-slate-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 shadow-sm">
                Disp: {p.stock_available} {p.unit}
              </span>
            </div>

            {/* Product Card Content */}
            <div className="p-4 flex flex-col flex-1">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-1">{p.name}</h3>
              </div>
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{p.supplier_name}</p>
              {p.description && (
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>
              )}

              <div className="mt-auto mb-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Precio mayorista</span>
                  <span className="text-lg font-black text-brand tracking-tight">
                    ${p.price_per_unit.toLocaleString('es-CO')}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {p.unit}</span>
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  Mín: {p.min_order_qty} {p.unit}
                </span>
              </div>

              {isSupplier ? (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="flex-1 rounded-xl border border-brand py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white transition">
                    Editar
                  </button>
                  <button onClick={() => removeProduct(p.id)} className="flex-1 rounded-xl border border-red-500 py-2 text-sm font-semibold text-red-500 hover:bg-red-500 hover:text-white transition">
                    Desactivar
                  </button>
                </div>
              ) : user?.role === 'gerente' ? (
                <div className="space-y-2">
                  {/* Selector rápido de cantidad */}
                  <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl p-1.5 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium pl-1.5">Cantidad ({p.unit}):</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [p.id]: Math.max(p.min_order_qty || 1, (prev[p.id] || p.min_order_qty || 1) - 1),
                          }))
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={p.min_order_qty || 1}
                        value={quantities[p.id] ?? (p.min_order_qty || 1)}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [p.id]: Math.max(1, Number(e.target.value)) }))
                        }
                        className="w-12 text-center text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded py-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [p.id]: (prev[p.id] || p.min_order_qty || 1) + 1,
                          }))
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openCustomization(p)}
                      className="px-3 rounded-xl border border-sky-500/40 bg-sky-50 dark:bg-sky-500/10 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition flex items-center justify-center gap-1 shrink-0"
                      title="Personalizar especificaciones de corte o empaque"
                    >
                      <span>⚙ Personalizar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => add(p, quantities[p.id] || Math.max(p.min_order_qty || 1, 1))}
                      className="flex-1 rounded-xl bg-brand py-2 text-xs sm:text-sm font-bold text-white hover:bg-brand-dark transition shadow-md shadow-brand/20"
                    >
                      Agregar al carrito
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 rounded-xl">
                  Solo los gerentes pueden comprar
                </div>
              )}
            </div>
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

      {/* Modal de Personalización de Pedido */}
      {customizingProduct && (
        <Modal
          title={`Personalizar: ${customizingProduct.name}`}
          onClose={() => setCustomizingProduct(null)}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <img
                src={getProductImage(customizingProduct)}
                alt={customizingProduct.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">{customizingProduct.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{customizingProduct.supplier_name}</p>
                <p className="text-sm font-bold text-brand mt-0.5">
                  ${customizingProduct.price_per_unit.toLocaleString('es-CO')} COP / {customizingProduct.unit}
                </p>
              </div>
            </div>

            {/* Cantidad a pedir */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Cantidad a ordenar ({customizingProduct.unit}):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomQty((q) => Math.max(customizingProduct.min_order_qty || 1, q - 1))}
                  className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 text-lg font-bold text-slate-800 dark:text-white"
                >
                  -
                </button>
                <input
                  type="number"
                  min={customizingProduct.min_order_qty || 1}
                  value={customQty}
                  onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value)))}
                  className="w-24 text-center font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-1.5 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setCustomQty((q) => q + 1)}
                  className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 text-lg font-bold text-slate-800 dark:text-white"
                >
                  +
                </button>
                <span className="text-xs text-slate-500 pl-2">
                  Subtotal: <b>${(customQty * customizingProduct.price_per_unit).toLocaleString('es-CO')} COP</b>
                </span>
              </div>
            </div>

            {/* Opciones dinámicas según tipo de producto (Bebidas, Lácteos, Carnes, Verduras, etc.) */}
            {customizingProduct && (() => {
              const cfg = getProductCustomizationConfig(customizingProduct);
              return (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {cfg.typeLabel}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {cfg.typeOptions.map((op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => setCustomCorte(customCorte === op ? '' : op)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            customCorte === op
                              ? 'bg-brand text-white border-brand'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {cfg.packLabel}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {cfg.packOptions.map((op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => setCustomEmpaque(op)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            customEmpaque === op
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notas especiales adicionales */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Instrucciones adicionales para el proveedor (opcional):
                    </label>
                    <textarea
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder={cfg.notesPlaceholder}
                      rows={2}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand"
                    />
                  </div>
                </>
              );
            })()}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCustomized}
                className="flex-[2] py-2.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-dark transition shadow-md shadow-brand/20"
              >
                Agregar al Carrito con Personalización
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Proveedor: Crear / Editar producto */}
      {modal && (
        <Modal title={editing ? `Editar ${editing.name}` : 'Nuevo producto'} onClose={() => setModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className={label}>Nombre</label>
              <input value={form.name} onChange={set('name')} className={input} required />
            </div>
            {(user?.role === 'admin' || !user?.supplier_id) && suppliers.length > 0 && (
              <div>
                <label className={label}>Proveedor asignado</label>
                <select value={form.supplier_id} onChange={set('supplier_id')} className={input}>
                  <option value="">Selecciona el proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
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
              <label className={label}>URL de la Imagen (Opcional)</label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/... o enlace de tu foto"
                value={form.image_url}
                onChange={set('image_url')}
                className={input}
              />
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
            <button className="w-full rounded-xl bg-brand py-2.5 font-bold text-white hover:bg-brand-dark transition shadow-md shadow-brand/20">
              {editing ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
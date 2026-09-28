import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, RegisterData } from '../context/AuthContext';
import { IconFood, IconTruck } from '../components/Icons';

const RESTAURANT_CATEGORIES = [
  { value: 'postres', label: 'Postres, Heladería & Pastelería' },
  { value: 'brunch', label: 'Brunch, Café & Panadería Artesanal' },
  { value: 'bbq', label: 'BBQ, Carnes & Parrilla' },
  { value: 'asiatico', label: 'Asiático (Sushi, Ramen, Wok)' },
  { value: 'latino', label: 'Latino & Comida Colombiana / Típica' },
  { value: 'hamburguesas', label: 'Hamburguesas, Alitas & Fast Food' },
  { value: 'pizzeria', label: 'Pizzería & Cocina Italiana' },
  { value: 'saludable', label: 'Saludable, Bowls & Vegano' },
];

const empty: RegisterData = {
  username: '',
  password: '',
  name: '',
  email: '',
  phone: '',
  type: 'restaurante',
  category: 'latino',
};

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterData>(empty);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof RegisterData) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        ...form,
        category: form.type === 'restaurante' ? form.category || 'latino' : undefined,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const input =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 transition';
  const label = 'mb-1 block text-xs font-bold text-slate-700 uppercase tracking-wider';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-brand/10 text-brand font-black text-2xl mb-2">
            Z
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Crear cuenta Xupply</h1>
          <p className="text-xs text-slate-500 mt-1">Conecta tu negocio a la red de suministros para gastronomía</p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'restaurante' })}
              className={`rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
                form.type === 'restaurante'
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconFood className="w-4 h-4" />
              <span>Restaurante</span>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'proveedor' })}
              className={`rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
                form.type === 'proveedor'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconTruck className="w-4 h-4" />
              <span>Proveedor</span>
            </button>
          </div>

          <div>
            <label className={label}>Nombre de tu Negocio / Empresa *</label>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder={form.type === 'restaurante' ? 'ej. Burger & Co.' : 'ej. Distribuidora del Oriente'}
              className={input}
              required
            />
          </div>

          {form.type === 'restaurante' && (
            <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 space-y-2">
              <label className="block text-xs font-bold text-brand-dark flex items-center gap-1.5">
                <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span>Clasificación Gastronómica del Restaurante *</span>
              </label>
              <p className="text-[11px] text-slate-500 leading-tight">
                De acuerdo a tus platos principales te recomendaremos los mejores proveedores mayoristas de insumos.
              </p>
              <select
                value={form.category}
                onChange={set('category')}
                className="w-full rounded-xl border border-brand/30 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                {RESTAURANT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Usuario (Login) *</label>
              <input
                value={form.username}
                onChange={set('username')}
                placeholder="ej. gerencia_local"
                className={input}
                required
              />
            </div>
            <div>
              <label className={label}>Contraseña *</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="Mínimo 6 caracteres"
                className={input}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Correo Electrónico</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="contacto@negocio.com"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Teléfono WhatsApp</label>
              <input
                value={form.phone}
                onChange={set('phone')}
                placeholder="ej. 3151234567"
                className={input}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-dark active:scale-98 transition disabled:opacity-50"
          >
            {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          ¿Ya tienes cuenta en Xupply?{' '}
          <Link to="/login" className="font-bold text-brand hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
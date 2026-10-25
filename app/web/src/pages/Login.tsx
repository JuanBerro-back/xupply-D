import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError((err as Error).message || 'Error de autenticación');
    }
  };

  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Estrellas + fugaces (base de prueba.txt, tintadas al brand) */}
      <div className="login-stars" aria-hidden="true" />
      <div className="login-shooting-star" aria-hidden="true" />
      <div className="login-shooting-star" aria-hidden="true" />
      <div className="login-shooting-star" aria-hidden="true" />
      {/* Orbes brand + viñeta para dar profundidad y sensación de confianza */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-brand/30 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/60 via-transparent to-[#082f49]/30" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl backdrop-blur-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-extrabold text-brand tracking-tight">Xupply</h1>
        </div>
        <p className="mb-8 text-sm text-slate-500 font-medium">Plataforma B2B de pedidos, inventario, facturación y logística</p>

        {error && <p className="mb-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600 font-medium">{error}</p>}
        
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">Usuario</label>
            <input 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-sm" 
              required 
              placeholder="Ej. domiciliario"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">Contraseña</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-sm" 
                required 
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button className="w-full rounded-xl bg-brand py-3.5 font-bold text-white shadow-lg shadow-brand/30 hover:bg-sky-600 hover:shadow-brand/40 active:scale-[0.98] transition-all">
            Ingresar
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-600 text-center font-medium">
          ¿Sin cuenta? <Link to="/register" className="text-brand font-bold hover:underline">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}

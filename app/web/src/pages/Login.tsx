import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 bg-slate-100">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        src="/login-bg.mp4"
      />
      <div className="absolute inset-0 bg-black/40" />
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
        <div className="mt-8 rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-700 block mb-1">Usuarios demo (contraseña demo1234):</span>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">admin</span>
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">gerente</span>
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">empleado</span>
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">proveedor</span>
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">domiciliario</span>
          </div>
        </div>
      </div>
    </div>
  );
}

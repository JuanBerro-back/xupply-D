import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppDownloadNotice from '../components/AppDownloadNotice';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        src="/login-bg.mp4"
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white/95 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand">Xupply</h1>
        </div>
        <p className="mb-4 text-sm text-gray-600">Plataforma B2B de pedidos, inventario, facturación y logística</p>

        {/* Banner destacado: ¿Aún no tienes Xupply App? */}
        <div className="mb-4">
          <AppDownloadNotice compact dismissible={false} />
        </div>



        {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Usuario</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded border px-3 py-2" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border px-3 py-2" required />
          </div>
          <button className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark">Ingresar</button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          ¿Sin cuenta? <Link to="/register" className="text-brand hover:underline">Regístrate</Link>
        </p>
        <div className="mt-4 rounded bg-gray-50 p-3 text-xs text-gray-600">
          Usuarios demo (contraseña <b>demo1234</b>): <b>admin</b> · <b>gerente</b> · <b>empleado</b> ·{' '}
          <b>proveedor</b> · <b>domiciliario</b>
        </div>
      </div>
    </div>
  );
}

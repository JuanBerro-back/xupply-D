import { Link } from 'react-router-dom';
import Logo from '../../../../shared/ui/Logo';

export function LandingNav() {
  return (
    <>
      {/* Top Navigation */}
      <nav>
        <div className="wrap">
          <div className="nav-brand">
            <Link to="/" className="flex items-center gap-2 group">
              <Logo size={36} showWordmark={true} />
            </Link>
          </div>

          <div className="nav-links">
            <a href="#features">Características</a>
            <a href="#simulador">Simulador</a>
            <a href="#roles">Roles</a>
            <a href="#como">Cómo Funciona</a>
            <a href="#comparativa">Beneficios</a>
          </div>

          <div className="nav-actions">
            <Link className="btn ghost sm" to="/login">
              Iniciar Sesión
            </Link>
            <Link className="btn sm" to="/register">
              Registrarse
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <>
      {/* Footer */}
      <footer>
        <div className="wrap footer-content">
          <div className="footer-left">
            <p>Xupply © 2026 • Plataforma B2B para Restaurantes y Proveedores</p>
            <p className="text-xs text-sky-400 font-medium mt-1">
              Creado por <strong className="text-white font-semibold">Juan Berroteran</strong> y <strong className="text-white font-semibold">Fabio Chamorro</strong> • Contacto: <a href="mailto:jdbpberroteran@gmail.com" className="underline hover:text-sky-300 transition-colors">jdbpberroteran@gmail.com</a>
            </p>
            <span>Bucaramanga, Santander, Colombia • Proyecto de Innovación Tecnológica • ADSO SENA</span>
          </div>

          <div className="footer-right">
            <a href="#features">Características</a>
            <a href="#simulador">Simulador</a>
            <a href="#roles">Roles</a>
            <Link to="/login">Iniciar Sesión</Link>
            <Link to="/register">Registro</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

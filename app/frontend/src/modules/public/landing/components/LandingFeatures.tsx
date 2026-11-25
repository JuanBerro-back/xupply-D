import type { LandingInteractions } from '../hooks';

type Props = Pick<LandingInteractions, 'handleCardMouseMove' | 'handleCardMouseLeave'>;

export function LandingFeatures({ handleCardMouseMove, handleCardMouseLeave }: Props) {
  return (
    <>
        {/* Features Section */}
        <section id="features">
          <div className="sec-head">
            <h2>Todo lo que tu cadena de suministros necesita</h2>
            <p className="sub">
              Diseñado especialmente para el sector gastronómico y distribuidor en Colombia. Del pedido al plato, sin hojas de cálculo.
            </p>
          </div>

          <div className="grid">
            {/* GPS Satelital */}
            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="feat-top">
                <div className="feat-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10" />
                    <path d="M12 6a6 6 0 1 0 6 6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </div>
              </div>
              <h3>Seguimiento GPS satelital</h3>
              <p>Rastreo en vivo sobre el área metropolitana de Bucaramanga con consola móvil para repartidores y telemetría de ruta.</p>
            </div>

            {/* Facturación DIAN */}
            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="feat-top">
                <div className="feat-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
              </div>
              <h3>Facturación electrónica DIAN</h3>
              <p>Emisión automática de factura electrónica con CUFE, código QR, IVA y cálculo de Impoconsumo según normativa colombiana.</p>
            </div>

            {/* Inventario FEFO */}
            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="feat-top">
                <div className="feat-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m7.5 4.27 9 5.15" />
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                </div>
              </div>
              <h3>Control de inventario FEFO</h3>
              <p>First Expire, First Out: prioriza automáticamente los lotes de alimentos próximos a vencer, minimizando pérdidas y mermas a cero.</p>
            </div>

            {/* Copiloto XupAI */}
            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="feat-top">
                <div className="feat-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4" />
                    <path d="M12 18v4" />
                    <path d="M4.93 4.93l2.83 2.83" />
                    <path d="M16.24 16.24l2.83 2.83" />
                    <path d="M2 12h4" />
                    <path d="M18 12h4" />
                    <path d="M4.93 19.07l2.83-2.83" />
                    <path d="M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
              </div>
              <h3>Copiloto XupAI</h3>
              <p>Asistente inteligente para análisis de food cost, pronóstico de demanda, sugerencia de compras por histórico y optimización de menú.</p>
            </div>

            {/* Control de roles RBAC */}
            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="feat-top">
                <div className="feat-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
              </div>
              <h3>Control de acceso por roles</h3>
              <p>Permisos granulares para Administradores, Gerentes de restaurante, Proveedores mayoristas, Repartidores y Cajeros.</p>
            </div>

            {/* Pensado para Colombia */}
            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="feat-top">
                <div className="feat-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                </div>
              </div>
              <h3>Pensado para Colombia</h3>
              <p>Soporte nativo para NIT, RUT, municipios de Santander, catálogos en pesos colombianos (COP) y despacho puerta a puerta.</p>
            </div>
          </div>
        </section>
    </>
  );
}

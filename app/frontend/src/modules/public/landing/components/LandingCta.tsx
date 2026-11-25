import { Link } from 'react-router-dom';

export function LandingCta() {
  return (
    <>
        {/* CTA Section */}
        <section>
          <div className="cta-box">
            <h2>Lleva tu operación al <span className="gt">siguiente nivel</span></h2>
            <p>
              Comienza a operar hoy mismo. Conéctate con los mejores distribuidores y gestiona tu cocina con precisión digital.
            </p>

            <div className="cta-buttons">
              <Link className="btn" to="/register">
                <span>Registrarse</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>

              <a className="btn ghost sm" href="/Xupply.apk" download>
                <span>Descargar APK Android</span>
              </a>
            </div>
          </div>
        </section>
    </>
  );
}

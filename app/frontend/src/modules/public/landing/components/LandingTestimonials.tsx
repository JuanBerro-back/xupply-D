import type { LandingInteractions } from '../hooks';

type Props = Pick<LandingInteractions, 'handleCardMouseMove' | 'handleCardMouseLeave'>;

export function LandingTestimonials({ handleCardMouseMove, handleCardMouseLeave }: Props) {
  return (
    <>
        {/* Testimonials */}
        <section>
          <div className="sec-head">
            <h2>Respaldado por el sector gastronómico de Bucaramanga</h2>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <p style={{ fontStyle: 'italic', fontSize: '0.98rem', marginBottom: '16px', color: 'var(--text)' }}>
                "Antes perdíamos hasta un 12% en mermas por vencimiento. Con el inventario FEFO de Xupply y el seguimiento GPS, las compras llegan justo a tiempo y las mermas bajaron a cero."
              </p>
              <div>
                <b style={{ display: 'block', color: 'var(--text)', fontSize: '0.95rem' }}>Chef Andrés Montoya</b>
                <span style={{ fontSize: '0.82rem', color: 'var(--brand-light)' }}>Fundador, Hamburguesería Angus & Co (Cabecera)</span>
              </div>
            </div>

            <div className="glass tilt feat" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <p style={{ fontStyle: 'italic', fontSize: '0.98rem', marginBottom: '16px', color: 'var(--text)' }}>
                "La facturación DIAN integrada nos ahorró 3 horas diarias de papeleo. Ahora los pedidos de 40 restaurantes se despachan con un solo clic."
              </p>
              <div>
                <b style={{ display: 'block', color: 'var(--text)', fontSize: '0.95rem' }}>Claudia Valenzuela</b>
                <span style={{ fontSize: '0.82rem', color: 'var(--brand-light)' }}>Gerente Comercial, Distribuidora Avícola Santander</span>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}

import type { LandingInteractions } from '../hooks';

type Props = Pick<LandingInteractions, 'handleCardMouseMove' | 'handleCardMouseLeave'>;

export function LandingSteps({ handleCardMouseMove, handleCardMouseLeave }: Props) {
  return (
    <>
        {/* Steps Flow (Cómo Funciona) */}
        <section id="como">
          <div className="sec-head">
            <h2>Cómo funciona Xupply</h2>
            <p className="sub">Cuatro etapas simples sincronizadas en una sola fuente de verdad.</p>
          </div>

          <div className="steps-grid">
            <div className="glass tilt step-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="step-num">01</div>
              <h3>El restaurante arma su pedido</h3>
              <p>Selecciona insumos frescos con precios de distribuidor y aplica descuentos por lotes FEFO disponibles.</p>
            </div>
            <div className="glass tilt step-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="step-num">02</div>
              <h3>El proveedor confirma y prepara</h3>
              <p>Bodega valida stock, descuenta inventario por lote de vencimiento y emite la orden de despacho.</p>
            </div>
            <div className="glass tilt step-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="step-num">03</div>
              <h3>El repartidor viaja con GPS en vivo</h3>
              <p>Ruta satelital transmitida segundo a segundo. Ambos lados ven el recorrido exacto por la ciudad.</p>
            </div>
            <div className="glass tilt step-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <div className="step-num">04</div>
              <h3>Recepción y factura electrónica</h3>
              <p>El restaurante inspecciona la mercancía, valida con firma digital y recibe la factura DIAN con CUFE.</p>
            </div>
          </div>
        </section>
    </>
  );
}

import type { LandingInteractions } from '../hooks';

type Props = Pick<LandingInteractions, 'selectedType' | 'currentProducts' | 'quantities' | 'cufeCode' | 'orderTransmittedMsg' | 'handleTypeChange' | 'handleQuantity' | 'rawSubtotal' | 'fefoSavings' | 'tax' | 'totalPayable' | 'handleEmitOrder'>;

export function LandingSimulator({ selectedType, currentProducts, quantities, cufeCode, orderTransmittedMsg, handleTypeChange, handleQuantity, rawSubtotal, fefoSavings, tax, totalPayable, handleEmitOrder }: Props) {
  return (
    <>
        {/* Live Interactive Simulator */}
        <section id="simulador">
          <div className="sec-head">
            <h2>Simula un Pedido con Descuento FEFO y Facturación DIAN</h2>
            <p className="sub">
              Calcula en tiempo real el ahorro por rotación FEFO y comprueba la emisión de la factura electrónica.
            </p>
          </div>

          <div className="simulator-box">
            {/* Left: Order Builder Controls */}
            <div className="sim-controls">
              <h3>1. Tipo de establecimiento:</h3>
              <div className="type-buttons">
                {[
                  { key: 'burger', label: 'Hamburguesería' },
                  { key: 'pizza', label: 'Pizzería' },
                  { key: 'cafe', label: 'Café y Panadería' },
                  { key: 'grill', label: 'Parrilla y Carnes' },
                ].map(t => (
                  <button
                    key={t.key}
                    className={`type-btn ${selectedType === t.key ? 'active' : ''}`}
                    onClick={() => handleTypeChange(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <h3>2. Configurar insumos requeridos:</h3>
              <div className="sim-items">
                {currentProducts.map(prod => (
                  <div key={prod.id} className="sim-item">
                    <div className="sim-item-info">
                      <span className="sim-item-name">{prod.name}</span>
                      <span className="sim-item-meta">
                        ${prod.price.toLocaleString('es-CO')} COP / {prod.unit} •{' '}
                        <span className="sim-item-fefo">
                          Lote FEFO (-{Math.round(prod.fefoDiscount * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="sim-qty-control">
                      <button className="qty-btn" onClick={() => handleQuantity(prod.id, -1)} aria-label="Disminuir">-</button>
                      <span className="qty-val">{quantities[prod.id] || 0}</span>
                      <button className="qty-btn" onClick={() => handleQuantity(prod.id, 1)} aria-label="Aumentar">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Simulated DIAN Electronic Receipt */}
            <div className="sim-receipt">
              <div className="receipt-header">
                <div className="receipt-title">
                  <span>Factura Electrónica de Venta</span>
                  <span className="dian-stamp">Vigente DIAN</span>
                </div>
                <div className="receipt-meta">
                  <div>Emisor: Xupply Mayorista B2B (NIT 901.482.193-4)</div>
                  <div>Adquirente: Restaurante Asociado Bucaramanga</div>
                  <div>Fecha: Hoy • Régimen Común</div>
                </div>
              </div>

              <div className="receipt-breakdown">
                <div className="receipt-row">
                  <span>Subtotal Bruto</span>
                  <span>${Math.round(rawSubtotal).toLocaleString('es-CO')} COP</span>
                </div>
                <div className="receipt-row discount">
                  <span>Ahorro Inteligente FEFO</span>
                  <span>-${Math.round(fefoSavings).toLocaleString('es-CO')} COP</span>
                </div>
                <div className="receipt-row">
                  <span>Impoconsumo (8%) / IVA</span>
                  <span>${tax.toLocaleString('es-CO')} COP</span>
                </div>
                <div className="receipt-total">
                  <span>Total a Pagar</span>
                  <b>${Math.round(totalPayable).toLocaleString('es-CO')} COP</b>
                </div>
              </div>

              <div className="cufe-box">
                <b>CUFE (Código Único de Factura Electrónica):</b>
                <span>{cufeCode}</span>
              </div>

              <button
                className="btn"
                style={{
                  width: '100%',
                  background: orderTransmittedMsg ? '#10b981' : undefined,
                }}
                onClick={handleEmitOrder}
              >
                <span>
                  {orderTransmittedMsg
                    ? '¡Orden PO Transmitida con CUFE!'
                    : 'Emitir Pedido y Factura Demo'}
                </span>
              </button>
            </div>
          </div>
        </section>
    </>
  );
}

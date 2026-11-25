
export function LandingComparison() {
  return (
    <>
        {/* Comparison Section */}
        <section id="comparativa">
          <div className="sec-head">
            <h2>Comparativa Operativa</h2>
            <p className="sub">Compara la operación tradicional frente a la plataforma Xupply.</p>
          </div>

          <div className="compare-table-wrapper">
            <table className="compare-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Aspecto Operativo</th>
                  <th style={{ width: '35%' }}>Método Tradicional</th>
                  <th style={{ width: '35%' }}>Con Xupply B2B</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>Pedidos y Compras</b></td>
                  <td className="compare-bad">Llamadas telefónicas y chats de mensajería dispersos</td>
                  <td className="compare-good">Catálogo digital con confirmación instantánea</td>
                </tr>
                <tr>
                  <td><b>Control de Vencimiento</b></td>
                  <td className="compare-bad">Alimentos vencen en bodega; mermas del 8% al 15%</td>
                  <td className="compare-good">Algoritmo FEFO estricto: rotación prioritaria y 0% mermas</td>
                </tr>
                <tr>
                  <td><b>Rastreo de Entregas</b></td>
                  <td className="compare-bad">Llamadas frecuentes al conductor durante la ruta</td>
                  <td className="compare-good">GPS satelital en vivo con telemetría y ETA en tiempo real</td>
                </tr>
                <tr>
                  <td><b>Facturación e Impuestos</b></td>
                  <td className="compare-bad">Facturas manuales en papel, errores en IVA e INC</td>
                  <td className="compare-good">Facturación electrónica DIAN con CUFE y QR al instante</td>
                </tr>
                <tr>
                  <td><b>Decisiones de Compra</b></td>
                  <td className="compare-bad">Estimaciones sin datos históricos de rotación</td>
                  <td className="compare-good">Copiloto XupAI analiza consumos históricos y sugiere la orden</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-scroll-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            <span>Desliza horizontalmente para ver la tabla completa</span>
          </div>
        </section>
    </>
  );
}

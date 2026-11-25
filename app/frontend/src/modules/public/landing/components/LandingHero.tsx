import { Link } from 'react-router-dom';
import { statuses } from '../landingData';
import type { LandingInteractions } from '../hooks';

type Props = Pick<LandingInteractions, 'typewriterText' | 'currentStep' | 'simulatedDeliverySuccess' | 'handleManualStep' | 'handleSimulateFastForward' | 'handleCardMouseMove' | 'handleCardMouseLeave'>;

export function LandingHero({ typewriterText, currentStep, simulatedDeliverySuccess, handleManualStep, handleSimulateFastForward, handleCardMouseMove, handleCardMouseLeave }: Props) {
  return (
    <>
      {/* Hero Section */}
      <header className="wrap hero">
        <div>
          <h1>
            Pide, rastrea y factura
            <br />
            <span className="gt">{typewriterText}</span>
            <span className="caret" />
          </h1>

          <p>
            La plataforma B2B que sincroniza restaurantes y proveedores de alimentos: pedidos en segundos,
            control de inventario FEFO sin mermas, facturación electrónica DIAN y rastreo satelital GPS.
          </p>

          <div className="hero-actions">
            <Link className="btn" to="/register">
              <span>Abrir Aplicación</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>

            <a className="btn ghost" href="#simulador">
              <span>Probar Simulador</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </a>
          </div>

          <p className="hero-subtext">Más de 50 restaurantes y distribuidores operando en Bucaramanga y Santander</p>
        </div>

        {/* Hero Visual: Live Telemetry HUD */}
        <div className="vis">
          <div className="glass tilt map-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
            <div className="map-header">
              <div className="map-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Telemetría GPS en Vivo</span>
              </div>
              <div className="telemetry-row">
                <span>
                  Vel: <b>{statuses[currentStep].speed}</b>
                </span>
                <span>
                  ETA: <b>{statuses[currentStep].eta}</b>
                </span>
              </div>
            </div>

            {/* SVG Simulated Delivery Map */}
            <div className="map-wrap">
              <svg className="map-svg" viewBox="0 0 420 260" role="img" aria-label="Mapa interactivo con ruta de entrega en Bucaramanga">
                <defs>
                  <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0284c7" />
                    <stop offset="60%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="glow" />
                    <feComposite in="SourceGraphic" in2="glow" operator="over" />
                  </filter>
                </defs>

                {/* Grid map roads */}
                <g stroke="#1e293b" strokeWidth="1.2">
                  {[1, 2, 3, 4, 5, 6, 7].map(i => (
                    <line key={`v-${i}`} x1={i * 55} y1="0" x2={i * 55} y2="260" strokeDasharray="3 3" />
                  ))}
                  {[1, 2, 3, 4, 5].map(i => (
                    <line key={`h-${i}`} x1="0" y1={i * 50} x2="420" y2={i * 50} strokeDasharray="3 3" />
                  ))}
                </g>

                {/* Secondary roads */}
                <path d="M 20 60 Q 140 80 200 130 T 400 190" fill="none" stroke="#172554" strokeWidth="2" />
                <path d="M 60 240 Q 180 200 240 140 T 360 40" fill="none" stroke="#172554" strokeWidth="2" />

                {/* Landmarks labels */}
                <text x="35" y="235" fill="#64748b" fontSize="10" fontFamily="monospace">Bodega Central (Girón)</text>
                <text x="260" y="32" fill="#64748b" fontSize="10" fontFamily="monospace">Restaurante (Cabecera)</text>
                <text x="180" y="115" fill="#38bdf8" fontSize="9" opacity="0.6" fontFamily="monospace">Viaducto García Cadena</text>

                {/* Delivery Path Glow & Main */}
                <path
                  id="deliveryPath"
                  d="M 50 210 L 80 155 L 160 155 L 195 100 L 290 100 L 320 50 L 370 50"
                  fill="none"
                  stroke="url(#routeGrad)"
                  strokeWidth="8"
                  opacity="0.3"
                  filter="url(#routeGlow)"
                />
                <path
                  d="M 50 210 L 80 155 L 160 155 L 195 100 L 290 100 L 320 50 L 370 50"
                  fill="none"
                  stroke="url(#routeGrad)"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                >
                  <animate attributeName="stroke-dashoffset" from="28" to="0" dur="0.8s" repeatCount="indefinite" />
                </path>

                {/* Origin beacon */}
                <circle cx="50" cy="210" r="8" fill="#0284c7" />
                <circle cx="50" cy="210" r="3" fill="#ffffff" />

                {/* Destination beacon in Emerald */}
                <circle cx="370" cy="50" r="8" fill="#10b981">
                  <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="370" cy="50" r="4" fill="#ffffff" />

                {/* Moving vehicle marker */}
                <g>
                  <animateMotion dur="8s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#deliveryPath" />
                  </animateMotion>
                  <circle cx="0" cy="0" r="10" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                  <path d="M-3 -4 L4 0 L-3 4 Z" fill="#ffffff" />
                </g>
              </svg>
            </div>

            {/* Interactive Status Stepper */}
            <div className="map-footer">
              <div className="sts" id="stepper">
                {statuses.map((item, index) => (
                  <button
                    key={item.id}
                    className={'st' + (index === currentStep ? ' on' : '')}
                    onClick={() => handleManualStep(index)}
                    title={item.desc}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="bar">
                <i style={{ width: `${((currentStep + 1) / statuses.length) * 100}%` }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {statuses[currentStep].desc}
                </span>
                <button
                  onClick={handleSimulateFastForward}
                  className="btn ghost sm"
                  style={{ fontSize: '0.76rem', padding: '3px 10px' }}
                >
                  {simulatedDeliverySuccess ? '¡Entrega Completada!' : 'Simular Entrega'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

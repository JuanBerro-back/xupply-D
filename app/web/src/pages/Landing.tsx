import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import './Landing.css';

interface SimulatorProduct {
  id: number;
  name: string;
  unit: string;
  price: number;
  supplier: string;
  fefoDiscount: number;
  defaultQty?: number;
}

const simulatorProductsByType: Record<string, SimulatorProduct[]> = {
  burger: [
    { id: 101, name: 'Carne de Res Angus (Corte Parrilla)', unit: 'Kg', price: 34000, supplier: 'Cárnicos del Oriente', fefoDiscount: 0.15, defaultQty: 3 },
    { id: 102, name: 'Queso Cheddar Americano Tajado', unit: 'Bloque 1Kg', price: 26000, supplier: 'Lácteos Santander', fefoDiscount: 0.10, defaultQty: 2 },
    { id: 103, name: 'Pan Brioche Artesanal', unit: 'Bolsa x30', price: 28000, supplier: 'Panadería La Gran Vía', fefoDiscount: 0.20, defaultQty: 4 },
    { id: 104, name: 'Aceite Vegetal de Cocina', unit: 'Bidón 20L', price: 92000, supplier: 'Distribuciones Bucaramanga', fefoDiscount: 0.05, defaultQty: 1 },
    { id: 105, name: 'Tocineta Ahumada Tajada', unit: 'Paquete 1Kg', price: 31000, supplier: 'Avícola & Porcinos del Oriente', fefoDiscount: 0.12, defaultQty: 2 },
  ],
  pizza: [
    { id: 201, name: 'Harina de Trigo Especial Pizza 00', unit: 'Bulto 25Kg', price: 78000, supplier: 'Molinos del Oriente', fefoDiscount: 0.15, defaultQty: 2 },
    { id: 202, name: 'Queso Mozzarella en Bloque', unit: 'Barra 2.5Kg', price: 46000, supplier: 'Lácteos Santander', fefoDiscount: 0.10, defaultQty: 4 },
    { id: 203, name: 'Pasta de Tomate / Salsa Pizzera', unit: 'Bidón 5Kg', price: 32000, supplier: 'Salsas & Conservas Andinas', fefoDiscount: 0.12, defaultQty: 3 },
    { id: 204, name: 'Orégano Entero Seco Aromático', unit: 'Bolsa 1Kg', price: 18000, supplier: 'Especias & Aromas BGA', fefoDiscount: 0.20, defaultQty: 2 },
    { id: 205, name: 'Pepperoni Madurado Tajado', unit: 'Paquete 1Kg', price: 38000, supplier: 'Embutidos del Oriente', fefoDiscount: 0.08, defaultQty: 3 },
  ],
  cafe: [
    { id: 301, name: 'Café Especial Grano Tostado', unit: 'Bolsa 2.5Kg', price: 65000, supplier: 'Café Mesa de los Santos', fefoDiscount: 0.15, defaultQty: 2 },
    { id: 302, name: 'Leche Entera Barista Especial', unit: 'Caja x12 Litros', price: 42000, supplier: 'Lácteos Santander', fefoDiscount: 0.10, defaultQty: 3 },
    { id: 303, name: 'Harina de Trigo Pastelera Fina', unit: 'Bulto 25Kg', price: 72000, supplier: 'Molinos del Oriente', fefoDiscount: 0.15, defaultQty: 1 },
    { id: 304, name: 'Mantequilla Sin Sal Pura', unit: 'Bloque 5Kg', price: 58000, supplier: 'Lácteos del Oriente', fefoDiscount: 0.10, defaultQty: 1 },
    { id: 305, name: 'Azúcar Refinada de Alta Pureza', unit: 'Bulto 25Kg', price: 62000, supplier: 'Distribuciones Bucaramanga', fefoDiscount: 0.05, defaultQty: 1 },
  ],
  grill: [
    { id: 401, name: 'Punta de Anca / Picanha Premium', unit: 'Kg', price: 42000, supplier: 'Cárnicos del Oriente', fefoDiscount: 0.15, defaultQty: 4 },
    { id: 402, name: 'Bife de Chorizo Angus', unit: 'Kg', price: 45000, supplier: 'Cárnicos del Oriente', fefoDiscount: 0.12, defaultQty: 3 },
    { id: 403, name: 'Costilla de Cerdo Especial BBQ', unit: 'Kg', price: 26000, supplier: 'Porcinos del Oriente', fefoDiscount: 0.18, defaultQty: 3 },
    { id: 404, name: 'Carbón Vegetal de Quebracho', unit: 'Bulto 15Kg', price: 28000, supplier: 'Distribuciones del Oriente', fefoDiscount: 0.05, defaultQty: 2 },
    { id: 405, name: 'Sal Marina Gruesa Parrillera', unit: 'Bolsa 5Kg', price: 14000, supplier: 'Especias & Sales BGA', fefoDiscount: 0.10, defaultQty: 2 },
  ],
};

const statuses = [
  { id: 'recibido', label: 'Pedido recibido', time: '10:14 AM', desc: 'Restaurante confirma compra', speed: '0 km/h', eta: '28 min' },
  { id: 'confirmado', label: 'Proveedor confirma', time: '10:18 AM', desc: 'Stock FEFO validado', speed: '0 km/h (Bodega)', eta: '24 min' },
  { id: 'despacho', label: 'Despacho y lote', time: '10:25 AM', desc: 'Asignado a conductor', speed: '15 km/h', eta: '19 min' },
  { id: 'en_ruta', label: 'Conductor en ruta', time: '10:32 AM', desc: 'GPS satelital activo', speed: '44 km/h', eta: '8 min' },
  { id: 'entregado', label: 'Entregado y factura', time: '10:48 AM', desc: 'CUFE DIAN emitido', speed: '0 km/h (Destino)', eta: 'Entregado' },
];

const chips = [
  'GPS satelital en tiempo real',
  'Inventario inteligente FEFO',
  'Facturación electrónica DIAN',
  'Validación CUFE y QR',
  'Bucaramanga y Santander',
  'Copiloto XupAI para compras',
  'Seguridad RBAC y auditoría',
  'Punto de venta POS integrado',
  'Conexión directa Restaurante - Proveedor',
];

const rolesData = [
  {
    key: 'admin',
    name: 'Administrador',
    summary: 'Gobierna todo el ecosistema con telemetría de sistema, auditoría de eventos y supervisión financiera.',
    highlights: ['Auditoría completa de transacciones', 'Gestión de roles y permisos RBAC', 'Supervisión de comercios y usuarios'],
    mockupData: {
      title: 'Panel de Control Maestro',
      metrics: [
        { label: 'Volumen Facturado', val: '$54.820.000 COP' },
        { label: 'Comercios Activos', val: '48 Establecimientos' },
        { label: 'Tasa SLA Entregas', val: '99.4%' },
      ],
      actionText: 'Inspeccionar auditoría',
    },
  },
  {
    key: 'restaurante',
    name: 'Restaurante',
    summary: 'Abastece tu cocina en 3 clics con precios mayoristas directos, control de stock y seguimiento del camión en el mapa.',
    highlights: ['Catálogo multi-proveedor centralizado', 'Reordenamiento inteligente semanal', 'Alerta de bajo stock por porción'],
    mockupData: {
      title: 'Gestor de Abastecimiento',
      metrics: [
        { label: 'Última Orden', val: 'PO-742 (24 productos)' },
        { label: 'Ahorro Lote FEFO', val: '$148.000 COP' },
        { label: 'Tiempo de Entrega', val: '18 min restantes' },
      ],
      actionText: 'Generar pedido rápido',
    },
  },
  {
    key: 'proveedor',
    name: 'Proveedor',
    summary: 'Publica inventario, recibe pedidos confirmados, asigna conductores y despacha con trazabilidad de lotes.',
    highlights: ['Priorización FEFO en bodega', 'Asignación inmediata de rutas', 'Factura DIAN automática al despachar'],
    mockupData: {
      title: 'Centro de Despacho Mayorista',
      metrics: [
        { label: 'Pedidos por Despachar', val: '9 órdenes' },
        { label: 'Lotes FEFO en Rotación', val: '42 SKU activos' },
        { label: 'Flujo de Caja Hoy', val: '$18.450.000 COP' },
      ],
      actionText: 'Asignar flota de reparto',
    },
  },
  {
    key: 'conductor',
    name: 'Conductor',
    summary: 'Consola táctil con optimización de ruta GPS, tiempos estimados de llegada (ETA) y confirmación digital de entrega.',
    highlights: ['Navegación paso a paso en Bucaramanga', 'Prueba de entrega con firma o foto', 'Notificación inmediata al restaurante'],
    mockupData: {
      title: 'Consola Móvil de Ruta',
      metrics: [
        { label: 'Destino Actual', val: 'Cra 33 con Calle 48 - Cabecera' },
        { label: 'Velocidad Promedio', val: '42 km/h' },
        { label: 'Entrega Estimada', val: '10:48 AM' },
      ],
      actionText: 'Confirmar llegada a destino',
    },
  },
  {
    key: 'cajero',
    name: 'Cajero / POS',
    summary: 'Facturación rápida de mostrador con generación de CUFE, cálculo de propina voluntaria e impresión de tirilla fiscal.',
    highlights: ['Integración directa con caja', 'Dispersión de impuestos IVA e INC', 'Arqueo de turnos automático'],
    mockupData: {
      title: 'Terminal POS Electrónico',
      metrics: [
        { label: 'Ventas del Turno', val: '$3.890.000 COP' },
        { label: 'Facturas DIAN Emitidas', val: '64 tirillas' },
        { label: 'Tiempo por Transacción', val: '12 segundos' },
      ],
      actionText: 'Emitir factura con CUFE',
    },
  },
];

const words = ['en tiempo real', 'sin mermas (FEFO)', 'con factura DIAN y CUFE', 'con GPS satelital', 'en Bucaramanga'];

export default function Landing() {
  // 1. Typewriter state
  const [typewriterText, setTypewriterText] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIdx];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && charIdx < currentWord.length) {
      timeout = setTimeout(() => {
        setTypewriterText(currentWord.slice(0, charIdx + 1));
        setCharIdx(c => c + 1);
      }, 75);
    } else if (!isDeleting && charIdx === currentWord.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 1800);
    } else if (isDeleting && charIdx > 0) {
      timeout = setTimeout(() => {
        setTypewriterText(currentWord.slice(0, charIdx - 1));
        setCharIdx(c => c - 1);
      }, 35);
    } else if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setWordIdx(w => (w + 1) % words.length);
    }

    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, wordIdx]);

  // 2. Scroll Progress bar
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      const current = window.scrollY;
      setScrollProgress(total > 0 ? (current / total) * 100 : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 3. Particle network canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const mouse = { x: -999, y: -999 };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    const particles = Array.from({ length: window.innerWidth < 700 ? 30 : 65 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.3 + 1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const distMouse = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (distMouse < 140) {
          p.x += (p.x - mouse.x) * 0.006;
          p.y += (p.y - mouse.y) * 0.006;
        }

        ctx.fillStyle = '#38bdf8';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.18;
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  // 4. Stepper & Telemetry
  const [currentStep, setCurrentStep] = useState(0);
  const [autoStep, setAutoStep] = useState(true);
  const [simulatedDeliverySuccess, setSimulatedDeliverySuccess] = useState(false);

  useEffect(() => {
    if (!autoStep) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % statuses.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [autoStep]);

  const handleManualStep = (idx: number) => {
    setAutoStep(false);
    setCurrentStep(idx);
  };

  const handleSimulateFastForward = () => {
    setAutoStep(false);
    setCurrentStep(4);
    setSimulatedDeliverySuccess(true);
    setTimeout(() => {
      setSimulatedDeliverySuccess(false);
    }, 3000);
  };

  // 5. Simulator State
  const [selectedType, setSelectedType] = useState('burger');
  const currentProducts = simulatorProductsByType[selectedType] || simulatorProductsByType.burger;

  const [quantities, setQuantities] = useState<Record<number, number>>({
    101: 3,
    102: 2,
    103: 4,
    104: 1,
    105: 2,
  });
  const [cufeCode, setCufeCode] = useState('8f3b92c47a1098e21054de74b39a...01cb');
  const [orderTransmittedMsg, setOrderTransmittedMsg] = useState(false);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    const prods = simulatorProductsByType[type] || simulatorProductsByType.burger;
    const initialQty: Record<number, number> = {};
    prods.forEach(p => {
      initialQty[p.id] = p.defaultQty !== undefined ? p.defaultQty : 1;
    });
    setQuantities(initialQty);
  };

  const handleQuantity = (id: number, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  // Simulator calculations
  const rawSubtotal = currentProducts.reduce((acc, p) => acc + p.price * (quantities[p.id] || 0), 0);
  const fefoSavings = currentProducts.reduce((acc, p) => acc + p.price * (quantities[p.id] || 0) * p.fefoDiscount, 0);
  const subtotalAfterFefo = rawSubtotal - fefoSavings;
  const tax = Math.round(subtotalAfterFefo * 0.08); // 8% Impoconsumo
  const totalPayable = subtotalAfterFefo + tax;

  const handleEmitOrder = () => {
    const randHash = Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setCufeCode(`${randHash.slice(0, 16)}...${randHash.slice(-12)}`);
    setOrderTransmittedMsg(true);
    setTimeout(() => {
      setOrderTransmittedMsg(false);
    }, 3500);
  };

  // 6. Role Explorer Tabs
  const [activeRole, setActiveRole] = useState('admin');

  // 7. 3D Card Tilt handler
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    card.style.setProperty('--ry', (px - 0.5) * 12 + 'deg');
    card.style.setProperty('--rx', (0.5 - py) * 12 + 'deg');
    card.style.setProperty('--mx', px * 100 + '%');
    card.style.setProperty('--my', py * 100 + '%');
  };

  const handleCardMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  };

  return (
    <div className="landing-page">
      {/* Top Scroll Progress Line */}
      <div id="pg" style={{ width: `${scrollProgress}%` }} />

      {/* Ambient Subtle Blurs */}
      <div className="aur" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      {/* Interactive Canvas Particle Network */}
      <canvas id="fx" ref={canvasRef} aria-hidden="true" />

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

      {/* Infinite Marquee Ticker */}
      <div className="mq" aria-hidden="true">
        <div>
          {[...chips, ...chips].map((chip, i) => (
            <span key={i}>
              <b>•</b> {chip}
            </span>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="wrap">
        {/* KPI Stats Section */}
        <section>
          <div className="stats">
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">5</b>
              <span>Roles con permisos configurables</span>
            </div>
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">99.8%</b>
              <span>Entregas a tiempo con ruta optimizada</span>
            </div>
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">100%</b>
              <span>Cumplimiento normativo DIAN y CUFE</span>
            </div>
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">0%</b>
              <span>Mermas por vencimiento con FEFO</span>
            </div>
          </div>
        </section>

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
              <h4>1. Tipo de establecimiento:</h4>
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

              <h4>2. Configurar insumos requeridos:</h4>
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

        {/* Roles Section */}
        <section id="roles">
          <div className="sec-head">
            <h2>Una experiencia dedicada para cada rol</h2>
            <p className="sub">
              Consolas especializadas para cada usuario dentro de la cadena de suministro.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="role-tabs">
            {rolesData.map(role => (
              <button
                key={role.key}
                className={'role-tab-btn' + (activeRole === role.key ? ' active' : '')}
                onClick={() => setActiveRole(role.key)}
              >
                <span>{role.name}</span>
              </button>
            ))}
          </div>

          {/* Role Panels */}
          <div className="glass" style={{ padding: '28px' }}>
            {rolesData.map(role => (
              <div
                key={role.key}
                className={'role-panel' + (activeRole === role.key ? ' active' : '')}
              >
                <div className="role-info">
                  <h3>{role.name}</h3>
                  <p>{role.summary}</p>
                  <ul className="role-highlights">
                    {role.highlights.map((item, idx) => (
                      <li key={idx}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link className="btn sm" to="/register">
                    <span>Probar vista de {role.name}</span>
                  </Link>
                </div>

                <div className="mockup-preview">
                  <div className="mockup-header">
                    <div className="mockup-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="mockup-title">{role.mockupData.title}</div>
                  </div>

                  <div className="mockup-metrics">
                    {role.mockupData.metrics.map((m, idx) => (
                      <div key={idx} className="m-metric">
                        <span>{m.label}</span>
                        <b>{m.val}</b>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                      Acción principal en consola:
                    </span>
                    <button className="btn sm ghost" style={{ width: '100%' }}>
                      {role.mockupData.actionText}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

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

        {/* Comparison Section */}
        <section id="comparativa">
          <div className="sec-head">
            <h2>Comparativa Operativa</h2>
            <p className="sub">Compara la operación tradicional frente a la plataforma Xupply.</p>
          </div>

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
        </section>

        {/* Testimonials */}
        <section>
          <div className="sec-head">
            <h2>Respaldado por el sector gastronómico de Bucaramanga</h2>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
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
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap footer-content">
          <div className="footer-left">
            <p>Xupply © 2026 • Plataforma B2B para Restaurantes y Proveedores</p>
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
    </div>
  );
}

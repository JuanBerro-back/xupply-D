import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

const PLAN_SELECT: Record<string, { model: string; assistant: boolean; reports: boolean }> = {
  basico: { model: 'xupply-lite', assistant: true, reports: false },
  medio: { model: 'xupply-pro', assistant: true, reports: true },
  premium: { model: 'xupply-max', assistant: true, reports: true },
};

router.post('/chat', async (req, res) => {
  const { message, plan } = req.body as { message?: string; plan?: string };
  const cfg = PLAN_SELECT[plan ?? 'basico'] ?? PLAN_SELECT.basico;
  if (!message || !message.trim()) return res.status(400).json({ error: 'message es requerido' });

  const q = message.trim().toLowerCase();
  let reply = '';

  // 1. Preguntas sobre Llave de Entrega / Código de Seguridad
  if (q.includes('llave') || q.includes('codigo de entrega') || q.includes('código') || q.includes('seguridad')) {
    reply = `🔑 **Flujo de Seguridad con Llave de Entrega:**
1. Cuando el proveedor despacha un pedido, el sistema genera una **Llave de Seguridad de 4 dígitos** asignada a la entrega.
2. El **Domiciliario** lleva consigo este código en su panel o app móvil.
3. El **Gerente del restaurante** no ve el mapa GPS general, pero al abrir el pedido ve la dirección y los datos de quién lo transporta.
4. Al llegar al restaurante, el domiciliario le proporciona la llave al gerente.
5. El gerente ingresa la llave en su pantalla y pulsa *"Completar Envío con Llave"*, confirmando la entrega en tiempo real para ambas partes.`;
  }
  // 2. Preguntas sobre Jerarquía y Equipo (Gerente-Empleado, Proveedor-Domiciliario)
  else if (q.includes('equipo') || q.includes('empleado') || q.includes('domiciliario') || q.includes('jefe') || q.includes('jerarquia') || q.includes('jerarquía')) {
    reply = `👥 **Estructura Jerárquica en Xupply:**
- **Gerente de Restaurante:** Es el líder de operaciones gastronómicas. En el módulo **Equipo**, solo visualiza y gestiona a sus **Empleados Operativos** asignados a su restaurante.
- **Proveedor:** Es el líder logístico de distribución. En el módulo **Equipo**, solo visualiza y gestiona a su flota de **Domiciliarios / Conductores** con sus vehículos (moto, furgón o camión) y placas.
- **Domiciliario:** Cuenta con una interfaz enfocada en pedidos pendientes, mapa satelital GPS y su llave de entrega.`;
  }
  // 3. Preguntas sobre Planes de Suscripción Xupply
  else if (q.includes('plan') || q.includes('suscripcion') || q.includes('suscripción') || q.includes('precio') || q.includes('costo')) {
    reply = `⭐ **Planes de Suscripción Xupply:**
- **Plan Básico (Esencial - Gratis):** Acceso al catálogo digital B2B, creación de pedidos, control básico de inventario y soporte estándar.
- **Plan Medio (Crecimiento - $250.000/mes):** Todo lo básico + Costeo de recetas, Alertas de stock en tiempo real, Galería de proveedores recomendados y Gestión de equipo.
- **Plan Premium (Máximo - $500.000/mes):** Acceso total sin límites: Predicción de demanda con IA, Asistente Xupply IA ilimitado, Facturación electrónica e informes contables de flujo de caja avanzados.
*Puedes cambiar tu plan activo en cualquier momento desde la sección **Planes**.*`;
  }
  // 4. Preguntas sobre Categorización de Restaurantes y Recomendación de Proveedores
  else if (q.includes('categoria') || q.includes('categoría') || q.includes('tipo de restaurante') || q.includes('bbq') || q.includes('postre') || q.includes('brunch') || q.includes('asiatico') || q.includes('asiático') || q.includes('recomendar')) {
    reply = `🍽️ **Categorías y Recomendación Inteligente de Proveedores:**
- Al registrar tu restaurante puedes clasificarlo entre: *BBQ & Parrilla, Postres & Pastelería, Brunch & Cafés, Asiático & Sushi, Latino & Comida Típica, Hamburguesas & Fast Food, Pizzería & Italiana, o Marisquería*.
- Según tu categoría y tus platos, Xupply te recomienda en un **banner tipo galería fotográfica**:
  - **BBQ y Hamburguesas:** Proveedores de carnes maduradas, tocineta y carbón (ej. *Carnes El Paisa*).
  - **Postres y Brunch:** Proveedores de lácteos artesanales, mantequillas y frutas (ej. *Lácteos del Norte*).
  - **Asiático y Sushi:** Proveedores de pesca fresca, salmón y salsas (ej. *Mariscos del Caribe*).
  - **Latino:** Verduras frescas, tubérculos y bebidas regionales.`;
  }
  // 5. Preguntas sobre Prospectos y Clientes Potenciales (Para Proveedores)
  else if (q.includes('cliente potencial') || q.includes('prospecto') || q.includes('vender mas') || q.includes('posibles clientes')) {
    reply = `💼 **Clientes Potenciales para Proveedores:**
- En el panel del proveedor encuentras la sección **"Restaurantes Clientes Potenciales"**.
- El algoritmo compara tu catálogo (carnes, lácteos, verduras, bebidas o mariscos) con la oferta culinaria de los restaurantes de Bucaramanga y su área metropolitana.
- Te muestra un **Índice de Afinidad (%)**, los insumos que más demandan y un botón directo para enviarles tu catálogo mayorista.`;
  }
  // 6. Preguntas sobre Costeo de Platos y Food Cost (Compleja)
  else if (q.includes('food cost') || q.includes('costear') || q.includes('costo') || q.includes('receta') || q.includes('margen')) {
    reply = `📊 **Cálculo Profesional de Costeo y Food Cost:**
1. **Fórmula del Food Cost Unitario:**
   \`Food Cost = Costo de todos los ingredientes + Merma estimada (3% a 7%)\`
2. **Margen Recomendado para Restaurantes:**
   - **Platos Fuertes:** El costo de materia prima debe estar entre el **28% y 32%** del precio de venta sin impuestos.
   - **Bebidas y Coctelería:** Costo ideal entre el **15% y 20%**.
   - **Postres y Entradas:** Costo ideal entre el **22% y 26%**.
3. **Precio de Venta Sugerido (PVP):**
   \`PVP = Costo Total del Plato / 0.30\`
   *Ejemplo:* Si una hamburguesa cuesta $9.000 producirla, su precio de venta objetivo es \`$9.000 / 0.30 = $30.000\`.`;
  }
  // 7. Preguntas sobre Punto de Reorden y Rotación de Inventario (Compleja)
  else if (q.includes('reorden') || q.includes('punto de pedido') || q.includes('merma') || q.includes('rotacion') || q.includes('rotación')) {
    reply = `📦 **Optimización de Inventario y Punto de Reorden (ROP):**
- **Fórmula de Reorden:**
  \`ROP = (Demanda Diaria Promedio × Tiempo de Entrega del Proveedor en Días) + Stock de Seguridad\`
- **Consejos para reducir mermas:**
  1. Aplica rotación **PEPS** (Primero en Entrar, Primero en Salir).
  2. Ajusta el stock mínimo de perecederos (verduras/mariscos) a máximo 3 días de consumo.
  3. Para insumos secos o congelados, mantén de 7 a 10 días de inventario de seguridad.
  *Puedes activar el análisis predictivo de Xupply IA para ver sugerencias automáticas de compra.*`;
  }
  // 8. Preguntas sobre Notificaciones, Modo Oscuro, Idioma y Ajustes
  else if (q.includes('notificacion') || q.includes('notificación') || q.includes('campana') || q.includes('campanita') || q.includes('oscuro') || q.includes('claro') || q.includes('idioma') || q.includes('menu hamburguesa')) {
    reply = `⚙️ **Ajustes, Preferencias y Notificaciones:**
- **Campana de Notificaciones (🔔):** Ubicada en la esquina superior derecha del dashboard, te avisa en tiempo real cambios de pedidos y entregas.
- **Menú Hamburguesa (☰):** Te permite acceder a:
  - Modos Claro y Oscuro instantáneos con preservación visual.
  - Selector de idioma (Español / English).
  - Ajuste de preferencias y notificaciones sonoras.
  - Términos y condiciones del servicio B2B.
  - Cierre seguro de sesión.`;
  }
  // 9. Preguntas muy básicas ("tontas" o cotidianas)
  else if (q.includes('hola') || q.includes('buenos') || q.includes('que eres') || q.includes('quien eres') || q.includes('ayuda') || q.includes('como funciona')) {
    reply = `👋 ¡Hola! Soy **Xupply IA**, el copiloto inteligente de tu restaurante o empresa distribuidora.

Puedo responderte desde la pregunta más sencilla (como *dónde ver tus pedidos* o *cómo funciona la llave de entrega*) hasta las más complejas (como *fórmulas de food cost*, *ingeniería de menú*, *predicción de abastecimiento* o *estrategias de compras mayoristas*).

¿De qué tema te gustaría hablar hoy?`;
  }
  // 10. Respuesta general inteligente asistida
  else {
    reply = `🤖 **Respuesta de Xupply IA:**
Respecto a tu consulta sobre *"${message.trim()}"*:

En el ecosistema B2B de Xupply, la clave está en conectar la demanda diaria de cocina con la logística de proveedores locales. 

Te recomiendo verificar:
1. Si eres **Restaurante**: Revisa tus pedidos activos, ingresa la llave de seguridad cuando llegue tu domiciliario y optimiza tus costos con los proveedores recomendados para tu categoría.
2. Si eres **Proveedor**: Supervisa la flota en el mapa GPS, envía la llave de confirmación con tu domiciliario y contacta a los restaurantes potenciales identificados en tu panel.

Si requieres un análisis financiero o pronóstico detallado, puedes preguntarme específicamente sobre *costeo de recetas, cálculo de mermas, impuestos (IVA/impoconsumo) o gestión de inventario*.`;
  }

  return res.json({ reply, model: cfg.model, plan: plan ?? 'basico' });
});

router.post('/predict-inventory', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'Solo restaurantes usan predicción de inventario' });
    const result = await query('SELECT * FROM v_inventory_predictions WHERE restaurant_id = $1 ORDER BY urgency DESC', [
      user.restaurant_id,
    ]);
    const summary = result.rows.map((r) => ({
      item: r.item_name,
      current_stock: r.current_stock,
      min_stock: r.min_stock,
      urgency: r.urgency,
      recommended_order_qty: r.recommended_order_qty,
      trend: r.trend,
    }));
    const high = summary.filter((r) => r.urgency === 'high').length;
    const recommendation = high > 0
      ? `Tienes ${high} ítem(s) con prioridad alta de reposición.`
      : 'Tu inventario está dentro de niveles aceptables.';
    res.json({ summary, recommendation });
  } catch (err) {
    next(err);
  }
});

router.post('/report', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { type } = req.body as { type?: string };
    if (!user.restaurant_id) return res.status(403).json({ error: 'Solo restaurantes generan reportes' });
    const orders = await query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(total), 0) AS revenue,
              COALESCE(AVG(total), 0) AS avg_order
       FROM orders WHERE restaurant_id = $1`,
      [user.restaurant_id]
    );
    const inventory = await query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN stock_status = 'critical' THEN 1 ELSE 0 END), 0)::int AS critical
       FROM inventory WHERE restaurant_id = $1`,
      [user.restaurant_id]
    );
    const typeLabel = type === 'monthly' ? 'mensual' : 'general';
    res.json({
      title: `Reporte ${typeLabel} Xupply IA`,
      generated_at: new Date().toISOString(),
      orders: orders.rows[0],
      inventory: inventory.rows[0],
      recommendation:
        'Resumen IA: monitorea los pedidos en curso y repón los ítems de inventario con urgencia alta.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
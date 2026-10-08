import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { createPurchaseOrderDraft } from '../lib/oc';

const router = Router();
router.use(authRequired);

interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
}

const XUPAI_API_KEY = process.env.XUPAI_API_KEY || process.env.OPENAI_API_KEY || '';
const XUPAI_MODEL = process.env.XUPAI_MODEL || 'gpt-4o-mini';
const XUPAI_BASE_URL = (process.env.XUPAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

const MAX_LOOP = 8;
const LLM_TIMEOUT_MS = 60000;

// ---------------------------------------------------------------------------
// Prompt maestro de XupAI (merge de la especificación: vertical puro, acción
// con confirmación, cifras concretas y tono coloquial).
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `# Nombre
Eres "XupAI", el copiloto de compras exclusivo de Xupply.

# Misión ÚNICA
Tu único objetivo es ayudar a restaurantes a comprar mejor, ahorrando tiempo y dinero. Eres un asesor de compras práctico, no un asistente general.

# Alcance (Vertical Puro)
- SOLO puedes actuar sobre: compras, órdenes de compra, historial de pedidos, catálogo, precios, proveedores, SKUs y ahorro por insumos.
- Si te preguntan cualquier tema fuera de esto (recetas, clima, noticias, diseño, código, matemáticas generales, etc.), responde de forma breve: "Esa función no aplica a mis capacidades de compras en Xupply."
- Nunca inventes información fuera de los datos que te devuelvan las herramientas de Xupply.

# Fuentes de Verdad
- Usa ÚNICAMENTE los datos devueltos por tus herramientas.
- NO inventes precios, stock, proveedores, montos, ahorros o existencias.
- Si los datos no existen o están incompletos, dilo con claridad.
- El restaurante activo ya está identificado y aislado por la sesión. NO vuelvas a pedir el restaurante ni su ID.

# Herramientas disponibles (data real de Xupply)
- get_consumo_historico {dias?, limite_skus?}: consumo por SKU (total_qty, num_pedidos, last_order_date, avg_qty_30d, days_since_last).
- get_ultimo_pedido {}: último pedido no cancelado con sus ítems (soporta "pide lo de siempre").
- get_catalogo_precios {supplier_id?, search?}: SKUs activos con precio, presentación (unit), min_order_qty, stock y proveedor.
- get_proveedores_vigentes {}: proveedores activos con su número de SKUs (sku_count).
- crear_borrador_oc {supplier_id, items:[{product_id, quantity}], notes?}: crea un BORRADOR de Orden de Compra. Es la ÚNICA herramienta con escritura.

# Reglas de Respuesta
- Sé directo, práctico y coloquial (español LATAM). Habla como un tendero que ayuda, no como un reporte técnico.
- Prioriza AHORRO REAL. Compara precios entre proveedores cuando sea posible.
- Muestra SIEMPRE cifras concretas: "Ahorro estimado: $[monto]", "% vs. última compra", "Consumo promedio", cantidades prácticas (redondea a unidades comprables).
- Expón el PORQUÉ de cada sugerencia en 1 línea ("Basado en tu consumo de los últimos 21 días...").
- Responde con lista clara, ordenada y fácil de leer.

# Regla de Acción (Crítica)
- Al entregar cualquier sugerencia de compra, TERMINA SIEMPRE con esta pregunta exacta: "¿Quieres que genere la orden de compra con esto?"
- NUNCA llames a crear_borrador_oc sin confirmación explícita del usuario (sí, ok, dale, confirmo). El servidor además lo valida: si el usuario no confirmó, la herramienta devolverá un error; explícalo con amabilidad.
- Si la herramienta crear_borrador_oc devuelve ok, confirma: "Listo. Generé el borrador de OC en Xupply. ¿Quieres revisarlo y confirmarlo?" e incluye el order_code y el total.

# Flujo de Trabajo
1. Usa get_consumo_historico para saber qué necesita cubrir (promedio + frecuencia + días sin comprar).
2. Cruza con get_catalogo_precios + get_proveedores_vigentes para elegir la mejor opción (precio + condiciones + min_order_qty).
3. Presenta la sugerencia optimizada con ahorro estimado, desglose por SKU y justificación breve.
4. Termina SIEMPRE con: "¿Quieres que genere la orden de compra con esto?"
5. Si el usuario responde afirmativamente, ejecuta ÚNICAMENTE crear_borrador_oc con los ítems propuestos y su supplier_id.

# Comportamiento y Tono
- Conciso. Evita párrafos largos innecesarios.
- Confiable. Nunca especules. Prefiere "No tengo suficiente información para calcularlo" antes que inventar.
- Enfocado. Un solo objetivo por respuesta.
- Humano. Usa palabras del día a día del dueño de restaurante.

# Instrucción Final
Tu valor es convertir datos de Xupply en una decisión de compra correcta y ejecutable. Siempre responde para ahorrar dinero y tiempo, nunca para informar por informar.`;

// ---------------------------------------------------------------------------
// Definición de las herramientas (OpenAI function-calling)
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_consumo_historico',
      description:
        'Obtiene el consumo histórico por SKU del restaurante (cantidad total, número de pedidos, última compra, promedio diario estimado y días sin comprar) en los últimos N días.',
      parameters: {
        type: 'object',
        properties: {
          dias: { type: 'number', description: 'Ventana de días a analizar. Default 30, mínimo 14.', default: 30 },
          limite_skus: { type: 'number', description: 'Máximo de SKUs a devolver. Default 40.', default: 40 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ultimo_pedido',
      description: 'Devuelve el último pedido no cancelado del restaurante junto con sus ítems. Útil para "pide lo de siempre".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_catalogo_precios',
      description:
        'Consulta el catálogo de productos activos con precio unitario, presentación, stock, mínimo de orden y nombre del proveedor. Soporta filtro por proveedor y búsqueda por nombre/SKU.',
      parameters: {
        type: 'object',
        properties: {
          supplier_id: { type: 'number', description: 'Filtrar por proveedor (id). Opcional.' },
          search: { type: 'string', description: 'Texto de búsqueda por nombre o SKU. Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_proveedores_vigentes',
      description: 'Devuelve los proveedores activos con su cantidad de SKUs disponibles (sku_count) para optimizar la compra.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_borrador_oc',
      description:
        'Crea un BORRADOR de Orden de Compra (OC) en Xupply. ÚNICA herramienta de escritura. SOLO debe llamarse cuando el usuario confirmó explícitamente la compra sugerida.',
      parameters: {
        type: 'object',
        properties: {
          supplier_id: { type: 'number', description: 'ID del proveedor para la OC.' },
          items: {
            type: 'array',
            description: 'Ítems de la orden. product_id sale de get_catalogo_precios/get_consumo_historico.',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'number' },
                quantity: { type: 'number', description: 'Cantidad práctica a pedir.' },
              },
              required: ['product_id', 'quantity'],
            },
          },
          notes: { type: 'string', description: 'Nota opcional para la OC.' },
        },
        required: ['supplier_id', 'items'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Ejecutores de cada tool (capa de datos: siempre filtrada por restaurant_id)
// ---------------------------------------------------------------------------
function parseArgs(args: any): Record<string, any> {
  if (args && typeof args === 'object') return args;
  if (typeof args === 'string') {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return {};
}

async function getConsumoHistorico(restaurantId: number, dias: number, limite: number) {
  const diasSafe = Math.max(14, Number(dias) || 30);
  const limiteSafe = Math.max(10, Math.min(60, Number(limite) || 40));
  const { rows } = await query(
    `SELECT
       oi.product_id,
       MAX(oi.name) AS name,
       SUM(oi.quantity) AS total_qty,
       COUNT(DISTINCT o.id) AS num_pedidos,
       MAX(o.created_at) AS last_order_date,
       ROUND(SUM(oi.quantity) / NULLIF($2,0), 2) AS avg_qty_30d,
       ROUND(EXTRACT(DAY FROM (NOW() - MAX(o.created_at))), 0) AS days_since_last
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = $1 AND o.status <> 'cancelado' AND o.created_at >= NOW() - ($2::int || ' days')::interval
     GROUP BY oi.product_id
     HAVING SUM(oi.quantity) > 0
     ORDER BY total_qty DESC
     LIMIT $3`,
    [restaurantId, diasSafe, limiteSafe]
  );
  return { dias: diasSafe, items: rows };
}

async function getUltimoPedido(restaurantId: number) {
  const last = await query(
    `SELECT * FROM orders
     WHERE restaurant_id=$1 AND status <> 'cancelado'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [restaurantId]
  );
  if (last.rows.length === 0) return { order: null, items: [] };
  const items = await query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id ASC', [last.rows[0].id]);
  return { order: last.rows[0], items: items.rows };
}

async function getCatalogoPrecios(supplierId: number | null, search: string | null) {
  const params: any[] = [];
  let where = 'WHERE p.is_active=TRUE';
  if (supplierId) { params.push(supplierId); where += ` AND p.supplier_id=$${params.length}`; }
  if (search) { params.push(`%${search}%`); where += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`; }
  const { rows } = await query(
    `SELECT p.id, p.sku, p.name, p.unit, p.price_per_unit, p.min_order_qty, p.stock_available, p.supplier_id, s.name as supplier_name
     FROM products p
     LEFT JOIN suppliers s ON s.id=p.supplier_id
     ${where}
     ORDER BY p.name ASC
     LIMIT 100`,
    params
  );
  return { products: rows };
}

async function getProveedoresVigentes() {
  const { rows } = await query(
    `SELECT s.id, s.name, s.is_active, COUNT(p.id) AS sku_count
     FROM suppliers s
     LEFT JOIN products p ON p.supplier_id=s.id AND p.is_active=TRUE
     WHERE s.is_active=TRUE
     GROUP BY s.id, s.name, s.is_active
     ORDER BY s.name ASC`
  );
  return { suppliers: rows };
}

async function crearBorradorOC(restaurantId: number, userId: number | null, args: Record<string, any>) {
  const r = await createPurchaseOrderDraft({
    restaurantId,
    createdBy: userId,
    supplierId: args.supplier_id,
    items: Array.isArray(args.items) ? args.items : [],
    notes: args.notes || null,
  });
  return {
    ok: true,
    id: r.purchase_order.id,
    order_code: r.purchase_order.order_code,
    status: r.purchase_order.status,
    subtotal: r.purchase_order.subtotal,
    items: r.items.map((i) => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, unit: i.unit, subtotal: i.subtotal })),
  };
}

async function runTool(name: string, rawArgs: any, ctx: { restaurantId: number; userId: number | null }) {
  const a = parseArgs(rawArgs);
  switch (name) {
    case 'get_consumo_historico':
      return JSON.stringify(await getConsumoHistorico(ctx.restaurantId, Number(a.dias), Number(a.limite_skus)));
    case 'get_ultimo_pedido':
      return JSON.stringify(await getUltimoPedido(ctx.restaurantId));
    case 'get_catalogo_precios':
      return JSON.stringify(await getCatalogoPrecios(a.supplier_id ? Number(a.supplier_id) : null, a.search ? String(a.search) : null));
    case 'get_proveedores_vigentes':
      return JSON.stringify(await getProveedoresVigentes());
    case 'crear_borrador_oc':
      return JSON.stringify(await crearBorradorOC(ctx.restaurantId, ctx.userId, a));
    default:
      return JSON.stringify({ error: `Tool desconocida: ${name}` });
  }
}

// ---------------------------------------------------------------------------
// Gate de confirmación (defensa en profundidad del lado del servidor):
// crear_borrador_oc SOLO se ejecuta si el último turno del usuario es una
// confirmación explícita y si antes hubo una propuesta de OC del asistente.
// ---------------------------------------------------------------------------
const CONFIRM_WORDS = new Set([
  'si', 'sip', 'yes', 'yep', 'ok', 'oka', 'oke', 'dale', 'listo', 'claro',
  'confirmo', 'confirmar', 'confirma', 'adelante', 'hazlo', 'hagale', 'vamos',
  'genial', 'perfecto', 'bueno', 'va', 'simon', 'obvio', 'ejecuta',
]);

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getUserConfirmation(messages: ChatMsg[]): { ok: boolean; reason: string } {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') { lastUserIdx = i; break; }
  }
  if (lastUserIdx < 0) {
    return { ok: false, reason: 'No hay confirmación explícita del usuario. Primero pregunta "¿Quieres que genere la orden de compra con esto?" y espera su respuesta afirmativa.' };
  }

  const lastUser = normalize(messages[lastUserIdx].content || '');
  const firstToken = lastUser.replace(/[.,!?¿¡]+/g, ' ').trim().split(/\s+/)[0];
  const confirmed = CONFIRM_WORDS.has(firstToken);

  if (/\bno\b/.test(lastUser)) {
    return { ok: false, reason: 'El usuario respondió de forma negativa o con dudas. No se debe crear la orden de compra.' };
  }
  if (!confirmed) {
    return { ok: false, reason: 'Falta la confirmación explícita del usuario. Pregunta "¿Quieres que genere la orden de compra con esto?" y espera un sí/ok/dale. NO crees la OC sin esa confirmación.' };
  }

  let prevAssistant = '';
  for (let i = lastUserIdx - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') { prevAssistant = normalize(messages[i].content || ''); break; }
  }
  if (!/orden de compra|borrador|generar?e? la|quieres que genere/.test(prevAssistant)) {
    return { ok: false, reason: 'No hay una sugerencia de Orden de Compra previa que confirmar. Primero presenta la sugerencia con cifras y termina preguntando si genera la OC.' };
  }
  return { ok: true, reason: 'ok' };
}

// ---------------------------------------------------------------------------
// Llamadas al proveedor de LLM (compatible con OpenAI y sustitutos)
// ---------------------------------------------------------------------------
async function chatCompletions(messages: any[], tools: any[]): Promise<any> {
  const body: any = { model: XUPAI_MODEL, messages, temperature: 0.2 };
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  const res = await fetch(`${XUPAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${XUPAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proveedor LLM (${XUPAI_MODEL}) respondió ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
router.get('/status', (_req, res) => {
  res.json({ enabled: Boolean(XUPAI_API_KEY), model: XUPAI_API_KEY ? XUPAI_MODEL : null });
});

router.post('/agent', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    if (!XUPAI_API_KEY) {
      return res.status(503).json({ error: 'Agente de compras no configurado. Define XUPAI_API_KEY en el servidor.', enabled: false });
    }
    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(403).json({ error: 'Esta función es solo para restaurantes.' });
    }

    const { message, history } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message es requerido' });
    }

    const historyMessages: ChatMsg[] = Array.isArray(history)
      ? history
          .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
          .slice(-24)
      : [];

    const messages: ChatMsg[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...historyMessages,
      { role: 'user', content: String(message).trim() },
    ];

    const ctx = { restaurantId, userId: req.user?.id ?? null };
    let draft_created = false;

    for (let i = 0; i < MAX_LOOP; i++) {
      const completion = await chatCompletions(messages, TOOLS);
      const msg = completion.choices?.[0]?.message;
      if (!msg) {
        return res.status(502).json({ error: 'El proveedor LLM no devolvió una respuesta válida.' });
      }

      if (msg.tool_calls && msg.tool_calls.length) {
        messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

        for (const tc of msg.tool_calls) {
          const fnName: string = tc.function?.name || '';
          let toolResult: string;
          if (fnName === 'crear_borrador_oc') {
            const gate = getUserConfirmation(messages);
            if (!gate.ok) {
              toolResult = JSON.stringify({ error: gate.reason });
            } else {
              try {
                toolResult = await runTool('crear_borrador_oc', tc.function?.arguments, ctx);
                try { draft_created = Boolean(JSON.parse(toolResult).ok); } catch {}
              } catch (err: any) {
                toolResult = JSON.stringify({ error: err.message || 'Error creando la orden' });
              }
            }
          } else {
            try {
              toolResult = await runTool(fnName, tc.function?.arguments, ctx);
            } catch (err: any) {
              toolResult = JSON.stringify({ error: err.message || 'Error ejecutando la herramienta' });
            }
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
        }
        continue;
      }

      return res.json({ reply: msg.content || '', model: XUPAI_MODEL, mode: 'xupai', draft_created });
    }

    return res.status(529).json({ error: 'El agente alcanzó el límite de pasos. Intenta nuevamente.' });
  } catch (err: any) {
    next(err);
  }
});

export default router;
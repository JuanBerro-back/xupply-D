import { createPurchaseOrderDraft } from '../../../shared/lib/oc';
import { ChatMsg } from './xupai.types';
import { getConsumoHistorico, getUltimoPedido, getCatalogoPrecios, getProveedoresVigentes } from './xupai.repository';

export const XUPAI_API_KEY = process.env.XUPAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
export const XUPAI_MODEL = process.env.XUPAI_MODEL || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini');
export const XUPAI_BASE_URL = (
  process.env.XUPAI_BASE_URL ||
  (process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : 'https://api.openai.com/v1')
).replace(/\/+$/, '');

export const MAX_LOOP = 8;
export const LLM_TIMEOUT_MS = 60000;

export const SYSTEM_PROMPT = `# Nombre
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

export const TOOLS = [
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

export function parseArgs(args: any): Record<string, any> {
  if (args && typeof args === 'object') return args;
  if (typeof args === 'string') {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return {};
}

export async function crearBorradorOC(restaurantId: number, userId: number | null, args: Record<string, any>) {
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

export async function runTool(name: string, rawArgs: any, ctx: { restaurantId: number; userId: number | null }) {
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
// crear_borrador_oc SOLO se ejecuta si el usuario confirmó explícitamente
// DESPUÉS de que el servidor emitiera una propuesta de OC. El estado vive en
// el servidor: no se confía en el historial enviado por el cliente, que podría
// inyectar un turno falso del asistente para saltarse la confirmación.
// ---------------------------------------------------------------------------
export const CONFIRM_WORDS = new Set([
  'si', 'sip', 'yes', 'yep', 'ok', 'oka', 'oke', 'dale', 'listo', 'claro',
  'confirmo', 'confirmar', 'confirma', 'adelante', 'hazlo', 'hagale', 'vamos',
  'genial', 'perfecto', 'bueno', 'va', 'simon', 'obvio', 'ejecuta',
]);

export const PROPOSAL_TTL_MS = 10 * 60 * 1000;
export const pendingProposals = new Map<number, number>();

export function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function markProposal(userId: number) {
  pendingProposals.set(userId, Date.now());
  if (pendingProposals.size > 5000) {
    const now = Date.now();
    for (const [key, ts] of pendingProposals) {
      if (now - ts > PROPOSAL_TTL_MS) pendingProposals.delete(key);
    }
  }
}

export function getUserConfirmation(messages: ChatMsg[], userId: number): { ok: boolean; reason: string } {
  const proposedAt = pendingProposals.get(userId);
  if (!proposedAt || Date.now() - proposedAt > PROPOSAL_TTL_MS) {
    return {
      ok: false,
      reason: 'No hay una propuesta de Orden de Compra vigente. Primero presenta la sugerencia y termina preguntando "¿Quieres que genere la orden de compra con esto?"',
    };
  }

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') { lastUserIdx = i; break; }
  }
  if (lastUserIdx < 0) {
    return { ok: false, reason: 'No hay confirmación explícita del usuario.' };
  }

  const lastUser = normalize(messages[lastUserIdx].content || '');
  const firstToken = lastUser.replace(/[.,!?¿¡]+/g, ' ').trim().split(/\s+/)[0];
  if (/\bno\b/.test(lastUser) || !CONFIRM_WORDS.has(firstToken)) {
    return { ok: false, reason: 'Falta la confirmación explícita del usuario. Espera un sí/ok/dale antes de crear la OC.' };
  }
  return { ok: true, reason: 'ok' };
}

// Límite de uso del agente para evitar abuso de costos del proveedor LLM.
export const agentRate = new Map<number, { count: number; resetAt: number }>();
export const AGENT_MAX_REQUESTS = 30;
export const AGENT_WINDOW_MS = 10 * 60 * 1000;

export function checkAgentRateLimit(userId: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = agentRate.get(userId);
  if (!entry || entry.resetAt <= now) {
    agentRate.set(userId, { count: 1, resetAt: now + AGENT_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > AGENT_MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Llamadas al proveedor de LLM (compatible con OpenAI y sustitutos)
// ---------------------------------------------------------------------------
export async function chatCompletions(messages: any[], tools: any[]): Promise<any> {
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
    // El detalle del proveedor se registra solo en el servidor; nunca se
    // devuelve al cliente (podría filtrar configuración interna).
    console.error(`[XupAI] Proveedor LLM (${XUPAI_MODEL}) respondió ${res.status}: ${text.slice(0, 400)}`);
    const error = new Error('No se pudo contactar al proveedor de IA. Intenta nuevamente.') as Error & {
      status?: number;
      expose?: boolean;
    };
    error.status = 502;
    error.expose = true;
    throw error;
  }
  return res.json();
}

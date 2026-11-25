import { Request, Response, NextFunction } from 'express';
import { ChatMsg } from './xupai.types';
import { XUPAI_API_KEY, XUPAI_MODEL, MAX_LOOP, SYSTEM_PROMPT, TOOLS, runTool, markProposal, getUserConfirmation, checkAgentRateLimit, chatCompletions, pendingProposals, normalize } from './xupai.service';

export function status(_req: Request, res: Response) {
  res.json({ enabled: Boolean(XUPAI_API_KEY), model: XUPAI_API_KEY ? XUPAI_MODEL : null });
}

export async function agent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!XUPAI_API_KEY) {
      return res.status(503).json({ error: 'Agente de compras no configurado. Define XUPAI_API_KEY en el servidor.', enabled: false });
    }
    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(403).json({ error: 'Esta función es solo para restaurantes.' });
    }

    const rate = checkAgentRateLimit(req.user!.id);
    if (!rate.ok) {
      res.setHeader('Retry-After', String(rate.retryAfter));
      return res.status(429).json({ error: 'Has hecho demasiadas consultas a XupAI. Intenta más tarde.' });
    }

    const { message, history } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message es requerido' });
    }
    if (String(message).length > 2000) {
      return res.status(400).json({ error: 'message no puede superar 2000 caracteres' });
    }

    const historyMessages: ChatMsg[] = Array.isArray(history)
      ? history
          .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
          .slice(-24)
          .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
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
            const gate = getUserConfirmation(messages, ctx.userId ?? 0);
            if (!gate.ok) {
              toolResult = JSON.stringify({ error: gate.reason });
            } else {
              try {
                toolResult = await runTool('crear_borrador_oc', tc.function?.arguments, ctx);
                try {
                  if (JSON.parse(toolResult).ok) {
                    draft_created = true;
                    pendingProposals.delete(ctx.userId ?? 0);
                  }
                } catch {}
              } catch (err: any) {
                console.error('[XupAI] Error creando borrador de OC:', err);
                toolResult = JSON.stringify({ error: 'No se pudo crear la orden de compra. Intenta nuevamente.' });
              }
            }
          } else {
            try {
              toolResult = await runTool(fnName, tc.function?.arguments, ctx);
            } catch (err: any) {
              console.error(`[XupAI] Error ejecutando herramienta ${fnName}:`, err);
              toolResult = JSON.stringify({ error: 'No se pudo consultar la información solicitada.' });
            }
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
        }
        continue;
      }

      const reply = msg.content || '';
      // Si el asistente propone generar la OC, habilitamos la confirmación
      // del lado del servidor durante los próximos 10 minutos.
      if (/quieres que genere/i.test(normalize(reply))) {
        markProposal(ctx.userId ?? 0);
      }
      return res.json({ reply, model: XUPAI_MODEL, mode: 'xupai', draft_created });
    }

    return res.status(529).json({ error: 'El agente alcanzó el límite de pasos. Intenta nuevamente.' });
  } catch (err: any) {
    next(err);
  }
}

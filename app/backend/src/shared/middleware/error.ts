import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function notFound(req: Request, res: Response) {
  // No reflejar la URL completa en producción (evita contenido reflejado).
  const detail =
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
      ? 'Ruta no encontrada'
      : `Ruta no encontrada: ${req.method} ${req.originalUrl}`;
  res.status(404).json({ error: detail });
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = randomUUID();
  // Log interno completo; al cliente solo un mensaje genérico + id de correlación.
  // Antes se devolvía `err.message`, que filtraba SQL, nombres de tablas y
  // detalles del pool de conexiones a cualquier usuario.
  console.error(`[error] requestId=${requestId} ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  const rawStatus = Number((err as any)?.status);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const safeMessage = (err as any)?.expose === true && typeof err.message === 'string' ? err.message : 'Error interno del servidor';
  res.status(status).json({ error: safeMessage, requestId });
}

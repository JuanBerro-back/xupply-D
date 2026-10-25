"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
exports.errorHandler = errorHandler;
const crypto_1 = require("crypto");
function notFound(req, res) {
    // No reflejar la URL completa en producción (evita contenido reflejado).
    const detail = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
        ? 'Ruta no encontrada'
        : `Ruta no encontrada: ${req.method} ${req.originalUrl}`;
    res.status(404).json({ error: detail });
}
function errorHandler(err, req, res, _next) {
    const requestId = (0, crypto_1.randomUUID)();
    // Log interno completo; al cliente solo un mensaje genérico + id de correlación.
    // Antes se devolvía `err.message`, que filtraba SQL, nombres de tablas y
    // detalles del pool de conexiones a cualquier usuario.
    console.error(`[error] requestId=${requestId} ${req.method} ${req.originalUrl}`, err);
    if (res.headersSent)
        return;
    const rawStatus = Number(err?.status);
    const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
    const safeMessage = err?.expose === true && typeof err.message === 'string' ? err.message : 'Error interno del servidor';
    res.status(status).json({ error: safeMessage, requestId });
}

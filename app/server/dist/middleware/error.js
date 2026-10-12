"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
exports.errorHandler = errorHandler;
function notFound(req, res) {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}
function errorHandler(err, _req, res, _next) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
}

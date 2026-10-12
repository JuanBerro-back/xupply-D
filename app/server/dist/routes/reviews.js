"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const realtime_1 = require("../lib/realtime");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
router.get('/', async (req, res, next) => {
    try {
        const { supplier_id } = req.query;
        const params = [];
        let sql = `SELECT rv.*, s.name AS supplier_name
               FROM "Reseña" rv
               JOIN suppliers s ON s.id = rv.supplier_id`;
        if (supplier_id) {
            params.push(supplier_id);
            sql += ` WHERE rv.supplier_id = $${params.length}`;
        }
        sql += ' ORDER BY rv.created_at DESC';
        const result = await (0, db_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, auth_1.roleRequired)('gerente', 'empleado', 'admin'), async (req, res, next) => {
    try {
        const user = req.user;
        const { supplier_id, rating, comment } = req.body;
        if (!supplier_id || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'supplier_id y rating (1-5) son requeridos' });
        }
        if (user.role === 'proveedor_admin') {
            return res.status(403).json({ error: 'Los proveedores no se califican a sí mismos' });
        }
        const userRow = await (0, db_1.query)('SELECT name FROM users WHERE id = $1', [user.id]);
        const result = await (0, db_1.query)(`INSERT INTO "Reseña" (supplier_id, reviewer_name, rating, comment, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [supplier_id, userRow.rows[0]?.name ?? user.username, rating, comment, user.id]);
        const agg = await (0, db_1.query)(`SELECT ROUND(AVG(rating)::numeric, 1) AS rating, COUNT(*)::int AS review_count
       FROM "Reseña" WHERE supplier_id = $1`, [supplier_id]);
        await (0, db_1.query)('UPDATE suppliers SET rating = $1, review_count = $2 WHERE id = $3', [
            agg.rows[0].rating,
            agg.rows[0].review_count,
            supplier_id,
        ]);
        const supplier = await (0, db_1.query)('SELECT id, name FROM suppliers WHERE id = $1', [supplier_id]);
        if (supplier.rowCount) {
            const admins = await (0, db_1.query)('SELECT id FROM users WHERE supplier_id = $1', [supplier_id]);
            for (const a of admins.rows) {
                (0, realtime_1.emitToUser)('notification:created', a.id, { message: `Nueva reseña para ${supplier.rows[0].name}` });
            }
        }
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;

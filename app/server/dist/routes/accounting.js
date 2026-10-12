"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
router.get('/', (0, auth_1.roleRequired)('gerente', 'admin'), async (req, res, next) => {
    try {
        const user = req.user;
        if (!user.restaurant_id)
            return res.status(403).json({ error: 'Solo restaurantes ven contabilidad' });
        const { type, from, to } = req.query;
        const params = [user.restaurant_id];
        let sql = 'SELECT * FROM accounting_transactions WHERE restaurant_id = $1';
        if (type) {
            params.push(type);
            sql += ` AND type = $${params.length}`;
        }
        if (from) {
            params.push(from);
            sql += ` AND transaction_date >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            sql += ` AND transaction_date <= $${params.length}`;
        }
        sql += ' ORDER BY transaction_date DESC, created_at DESC LIMIT 200';
        const result = await (0, db_1.query)(sql, params);
        const summary = await (0, db_1.query)(`SELECT COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END), 0) AS egresos
       FROM accounting_transactions WHERE restaurant_id = $1`, [user.restaurant_id]);
        res.json({ transactions: result.rows, summary: summary.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, auth_1.roleRequired)('gerente', 'admin'), async (req, res, next) => {
    try {
        const user = req.user;
        if (!user.restaurant_id)
            return res.status(403).json({ error: 'Solo restaurantes registran movimientos' });
        const { type, amount, description, category, payment_method, transaction_date } = req.body;
        if (!['ingreso', 'egreso'].includes(type) || amount === undefined) {
            return res.status(400).json({ error: 'type (ingreso|egreso) y amount requeridos' });
        }
        const result = await (0, db_1.query)(`INSERT INTO accounting_transactions (restaurant_id, type, amount, description, category, payment_method, transaction_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [user.restaurant_id, type, amount, description, category, payment_method, transaction_date ?? new Date(), user.id]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;

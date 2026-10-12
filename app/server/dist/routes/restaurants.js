"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
router.get('/', async (req, res, next) => {
    try {
        const { category, search } = req.query;
        const params = [];
        let sql = 'SELECT id, name, category, city, is_active, logo_url, description FROM restaurants WHERE is_active = TRUE';
        if (category) {
            params.push(category);
            sql += ` AND category ILIKE $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (name ILIKE $${params.length} OR city ILIKE $${params.length})`;
        }
        sql += ' ORDER BY name';
        const result = await (0, db_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.get('/me', async (req, res, next) => {
    try {
        const user = req.user;
        const result = await (0, db_1.query)(`SELECT r.* FROM restaurants r WHERE r.id = $1`, [user.restaurant_id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        if (req.params.id === 'me' || req.params.id === 'branches')
            return next(); // Let other handlers catch it
        const result = await (0, db_1.query)('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.put('/me', (0, auth_1.roleRequired)('gerente', 'admin'), async (req, res, next) => {
    try {
        const user = req.user;
        const { name, nit, phone, email, address, city, department, logo_url } = req.body;
        const result = await (0, db_1.query)(`UPDATE restaurants
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), phone = COALESCE($4, phone),
           email = COALESCE($5, email), address = COALESCE($6, address),
           city = COALESCE($7, city), department = COALESCE($8, department),
           logo_url = COALESCE($9, logo_url), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`, [user.restaurant_id, name, nit, phone, email, address, city, department, logo_url]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/branches', async (req, res, next) => {
    try {
        const result = await (0, db_1.query)('SELECT * FROM branches WHERE restaurant_id = $1 ORDER BY is_main DESC, name', [
            req.params.id,
        ]);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.post('/branches', (0, auth_1.roleRequired)('gerente', 'admin'), async (req, res, next) => {
    try {
        const user = req.user;
        const { name, address, phone, is_main } = req.body;
        const result = await (0, db_1.query)(`INSERT INTO branches (restaurant_id, name, address, phone, is_main)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [user.restaurant_id, name, address, phone, is_main ?? false]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;

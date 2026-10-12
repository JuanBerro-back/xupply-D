"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
router.get('/', async (_req, res, next) => {
    try {
        const result = await (0, db_1.query)('SELECT * FROM product_categories ORDER BY sort_order');
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;

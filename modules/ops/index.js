'use strict';

const express = require('express');
const router = express.Router();

const buyerRoutes = require('./buyers/route');
const productRoutes = require('./products/route');
const orderRoutes = require('./orders/route');
const orderDetailRoutes = require('./orderDetails/route');

const asyncHandler = require('./utils/asyncHandler');
const { BANK_ACCOUNTS } = require('./utils/bankAccounts');

/**
 * GET /api/v1/ops/bank-accounts
 * Returns the hardcoded bank account options.
 */
router.get('/bank-accounts', (req, res) => {
    res.json({ success: true, accounts: Object.values(BANK_ACCOUNTS) });
});

router.use('/buyers', buyerRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/order-details', orderDetailRoutes);

/**
 * Global error handler for ops module.
 */
router.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({
            success: false,
            error: `Duplicate value for ${field}: ${err.keyValue[field]}`
        });
    }

    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            error: messages.join(', ')
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: `Invalid ${err.path}: ${err.value}`
        });
    }

    return res.status(statusCode).json({ success: false, error: message });
});

module.exports = router;

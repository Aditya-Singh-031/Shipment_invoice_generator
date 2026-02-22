'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const orderDetailController = require('./controller');

router.get('/order/:orderId', asyncHandler(orderDetailController.getByOrderId));
router.get('/:id', asyncHandler(orderDetailController.getById));
router.put('/:id', asyncHandler(orderDetailController.update));
router.delete('/:id', asyncHandler(orderDetailController.remove));

module.exports = router;

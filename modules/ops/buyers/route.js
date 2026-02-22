'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const buyerController = require('./controller');

router.post('/', asyncHandler(buyerController.create));
router.get('/', asyncHandler(buyerController.list));
router.get('/:id', asyncHandler(buyerController.getById));
router.put('/:id', asyncHandler(buyerController.update));
router.delete('/:id', asyncHandler(buyerController.remove));

module.exports = router;

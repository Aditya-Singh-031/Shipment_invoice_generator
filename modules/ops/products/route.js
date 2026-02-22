'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const productController = require('./controller');

router.post('/', asyncHandler(productController.create));
router.get('/', asyncHandler(productController.list));
router.get('/part/:partNumber', asyncHandler(productController.getByPartNumber));
router.get('/:id', asyncHandler(productController.getById));
router.put('/:id', asyncHandler(productController.update));
router.delete('/:id', asyncHandler(productController.remove));

module.exports = router;

'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const asyncHandler = require('../utils/asyncHandler');
const orderController = require('./controller');

router.post('/', asyncHandler(orderController.create));
router.get('/', asyncHandler(orderController.list));
router.get('/:id', asyncHandler(orderController.getById));
router.put('/:id', asyncHandler(orderController.update));
router.patch('/:id/status', asyncHandler(orderController.updateStatus));
router.delete('/:id', asyncHandler(orderController.remove));

// --- PI Download endpoints ---
router.get('/:id/download-excel', asyncHandler(orderController.downloadExcel));
router.get('/:id/download-pdf', orderController.downloadPdf);
router.post('/upload-excel', upload.single('file'), orderController.uploadExcel);

module.exports = router;

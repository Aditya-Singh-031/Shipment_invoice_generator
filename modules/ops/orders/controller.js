'use strict';

const orderService = require('./service');
const { createOrderSchema, updateOrderSchema, updateStatusSchema } = require('./validation');
const { sendSuccess, sendError } = require('../utils/response');
const { generatePIExcel } = require('../utils/generatePIExcel');
const { generatePIWord } = require('../../../services/wordGenerator');
const { convertToPdf } = require('../utils/pdfConverter');

const create = async (req, res) => {
    const { error, value } = createOrderSchema.validate(req.body, { abortEarly: false });
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const result = await orderService.createOrder(value);
    return sendSuccess(res, result, 201);
};

const getById = async (req, res) => {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return sendError(res, 'Order not found', 404);
    return sendSuccess(res, { order });
};

const list = async (req, res) => {
    const { page, limit, status, dateFrom, dateTo, buyer_id, search } = req.query;
    const result = await orderService.listOrders({ page, limit, status, dateFrom, dateTo, buyer_id, search });
    return sendSuccess(res, result);
};

const update = async (req, res) => {
    const { error, value } = updateOrderSchema.validate(req.body, { abortEarly: false });
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const { items, ...orderFields } = value;
    const order = await orderService.updateOrder(req.params.id, orderFields, items);
    if (!order) return sendError(res, 'Order not found', 404);
    return sendSuccess(res, { order });
};

const updateStatus = async (req, res) => {
    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) return sendError(res, error.details.map(d => d.message).join(', '), 400);

    const order = await orderService.updateStatus(req.params.id, value.status);
    if (!order) return sendError(res, 'Order not found', 404);
    return sendSuccess(res, { order });
};

const remove = async (req, res) => {
    const order = await orderService.deleteOrder(req.params.id);
    if (!order) return sendError(res, 'Order not found', 404);
    return sendSuccess(res, { message: 'Order deleted successfully' });
};

const downloadExcel = async (req, res) => {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return sendError(res, 'Order not found', 404);

    const buyerName = order.buyer_id?.cust_name || order.buyer_id?.name || '';
    const buffer = generatePIExcel(order, order.order_details_id, buyerName);
    const filename = `PI_${order.order_number || order._id}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
};

const downloadPdf = async (req, res) => {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return sendError(res, 'Order not found', 404);

    const buyerData = order.buyer_id;
    const piData = {
        piNumber: order.pi_number || order.order_number,
        piDate: order.pi_date || order.order_date,
        termsOfPayment: order.payment_terms,
        termsOfDelivery: order.delivery_terms,
        bank_account_info: order.bank_account_info,
        buyer: {
            name: buyerData?.cust_name || buyerData?.name || '',
            address: buyerData?.address
        },
        consignee: order.consignee_id ? {
            name: order.consignee_id.cust_name || order.consignee_id.name || '',
            address: order.consignee_id.address
        } : null
    };

    const docxBuffer = await generatePIWord(piData, order.order_details_id?.items || [], order.currency);
    const pdfBuffer = await convertToPdf(docxBuffer);

    const filename = `PI_${order.order_number || order._id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
};

const fs = require('fs');
const xlsx = require('xlsx');

const uploadExcel = async (req, res) => {
    try {
        if (!req.file) return sendError(res, 'No file uploaded', 400);

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet); // Automatically uses first row as headers

        const items = [];
        jsonData.forEach(row => {
            // Find keys case-insensitively
            const findVal = (patterns) => {
                const key = Object.keys(row).find(k =>
                    patterns.some(p => k.toLowerCase().includes(p.toLowerCase()))
                );
                return key ? row[key] : null;
            };

            const brand = findVal(['brand']);
            const part_number = findVal(['code', 'part number', 'part_number']);
            const rate = findVal(['unit price', 'rate', 'price']);
            const quantity = findVal(['qty', 'quantity']);

            if (part_number || brand) {
                items.push({
                    brand: String(brand || '').trim(),
                    part_number: String(part_number || '').trim(),
                    rate: parseFloat(rate) || 0,
                    quantity: parseFloat(quantity) || 0,
                    igst_rate: 18,
                    quantity_filled: 0,
                    quantity_cancelled: 0
                });
            }
        });

        // Clean up temp file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        return sendSuccess(res, { items });
    } catch (error) {
        console.error('Excel upload error:', error);
        return sendError(res, 'Failed to parse Excel file: ' + error.message, 500);
    }
};

module.exports = { create, getById, list, update, updateStatus, remove, downloadExcel, downloadPdf, uploadExcel };


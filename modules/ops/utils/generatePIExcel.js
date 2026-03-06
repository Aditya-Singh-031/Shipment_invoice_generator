'use strict';

const xlsx = require('xlsx');

/**
 * Generate a PI Excel buffer from an order + order detail.
 *
 * Columns: Sr No, Brand, Part Number, Description, Qty, Rate, Amount
 * Plus summary rows at the bottom.
 */
const generatePIExcel = (order, orderDetail, buyerName) => {
    const items = (orderDetail && orderDetail.items) || [];

    const currLabel = order.currency || 'INR';

    const excelRows = items.map((item, idx) => {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const amount = qty * rate;
        return {
            'Sr No': idx + 1,
            'Brand': item.brand || '',
            'Part Number': item.part_number || '',
            'Description': item.description || '',
            'Qty': qty,
            'Rate': rate,
            'Amount': amount
        };
    });

    // Summary rows
    const subtotal = Number(order.subtotal) || 0;
    const grandTotal = Number(order.grand_total) || 0;

    excelRows.push({});
    excelRows.push({ 'Part Number': 'SUBTOTAL', 'Amount': subtotal });
    excelRows.push({ 'Part Number': 'GRAND TOTAL', 'Amount': grandTotal });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(excelRows);
    ws['!cols'] = [
        { wch: 6 },   // Sr No
        { wch: 15 },  // Brand
        { wch: 20 },  // Part Number
        { wch: 30 },  // Description
        { wch: 8 },   // Qty
        { wch: 12 },  // Rate
        { wch: 14 }   // Amount
    ];
    xlsx.utils.book_append_sheet(wb, ws, 'Proforma Invoice');

    // Add a header info sheet
    const headerData = [
        { Field: 'Exporter', Value: 'Morsebiz Technology Services Pvt Ltd' },
        { Field: 'Exporter GST', Value: '27AAPCM5559A1Z9' },
        { Field: 'Order Number', Value: order.order_number || '' },
        { Field: 'PI Number', Value: order.pi_number || '' },
        { Field: 'PI Date', Value: order.pi_date ? new Date(order.pi_date).toLocaleDateString('en-IN') : '' },
        { Field: 'Buyer', Value: buyerName || '' },
        { Field: 'Currency', Value: currLabel },
        { Field: 'Payment Terms', Value: order.payment_terms || '' },
        { Field: 'Delivery Terms', Value: order.delivery_terms || '' },
        { Field: 'Bank', Value: order.bank_account_key || '' },
        { Field: 'Grand Total', Value: grandTotal }
    ];
    const headerWS = xlsx.utils.json_to_sheet(headerData);
    headerWS['!cols'] = [{ wch: 18 }, { wch: 40 }];
    xlsx.utils.book_append_sheet(wb, headerWS, 'PI Details');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = { generatePIExcel };

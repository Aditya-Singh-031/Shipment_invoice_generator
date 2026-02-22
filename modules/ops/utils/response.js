'use strict';

/**
 * Standardised API response helpers.
 * Mirrors the existing { success, error } pattern used in the main app.
 */

const sendSuccess = (res, data = {}, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, ...data });
};

const sendError = (res, message = 'Something went wrong', statusCode = 500) => {
    return res.status(statusCode).json({ success: false, error: message });
};

module.exports = { sendSuccess, sendError };

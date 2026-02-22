'use strict';

/**
 * Wraps async route handlers so rejected promises are forwarded
 * to Express error handling instead of crashing the process.
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;

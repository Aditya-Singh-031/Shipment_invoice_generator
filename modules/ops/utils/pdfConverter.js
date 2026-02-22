'use strict';

const libre = require('libreoffice-convert');

/**
 * Convert a buffer (Docx) to PDF using LibreOffice.
 */
const convertToPdf = (buffer) => {
    return new Promise((resolve, reject) => {
        libre.convert(buffer, '.pdf', undefined, (err, done) => {
            if (err) reject(err);
            else resolve(done);
        });
    });
};

module.exports = { convertToPdf };

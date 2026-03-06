'use strict';

const mongoose = require('mongoose');

// Derive the ops DB URI from the main MONGO_URI
const baseUri = process.env.MONGO_URI || '';
const opsUri = baseUri.replace('/morsebiz?', '/morsebiz-ops?');

const opsDb = mongoose.createConnection(opsUri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000
});

opsDb.on('connected', () => console.log('Ops DB (morsebiz-ops) connected'));
opsDb.on('error', (err) => console.error('Ops DB error:', err));

module.exports = opsDb;

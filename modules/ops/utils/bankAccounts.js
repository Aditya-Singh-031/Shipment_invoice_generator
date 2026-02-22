'use strict';

/**
 * Hardcoded bank account options for Proforma Invoices.
 */
const BANK_ACCOUNTS = {
    HDFC: {
        key: 'HDFC',
        bank_name: 'HDFC BANK',
        account_name: 'Morsebiz Technology Services Private Limited',
        account_number: '50200067629395',
        ifsc_code: 'HDFC0000485',
        swift_code: 'HDFCINBB'
    },
    SBERBANK: {
        key: 'SBERBANK',
        bank_name: 'SBERBANK',
        account_name: 'Morsebiz Technology Services Private Limited',
        account_number: '40000356400000055100',
        ifsc_code: 'SABR0000001',
        swift_code: 'SABRINDD'
    }
};

const BANK_ACCOUNT_KEYS = Object.keys(BANK_ACCOUNTS);

const resolveBankAccount = (key) => {
    if (!key) return null;
    return BANK_ACCOUNTS[key.toUpperCase()] || null;
};

module.exports = { BANK_ACCOUNTS, BANK_ACCOUNT_KEYS, resolveBankAccount };

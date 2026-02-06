// src/utils/csvManager.js
const fs = require('fs').promises;
const path = require('path');

let products = [];

const HEADERS = ['name', 'prict', 'sku', 'category', 'unit'];

function addProduct(product) {
    const safeProduct = {};
    HEADERS.forEach(key => {
        safeProduct[key] = product[key] ?? '';
    });
    products.push(safeProduct);
}

function toCSV() {
    if (products.length === 0) {
        return HEADERS.join(',') + '\n';
    }

    const escapeCSV = (value) => {
        if (value == null || value === '') return '';
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`
    }

    const rows = products.map(p =>
        HEADERS.map(key => escapeCSV(p[key])).join(',')
    );

    return [HEADERS.join(','), ...rows].join('\n');
}

async function saveToFile(filename = 'products.csv') {
    const csvContent = toCSV();
    await fs.writeFile(filename, csvContent, 'utf8');
    console.log(`Saved ${products.length} product(s) to ${filename}`);
}

function clearProducts() {
    products = [];
}

function getProductCount() {
    return products.length;
}

module.exports = {
    addProduct,
    toCSV,
    saveToFile,
    clearProducts,
    getProductCount,
    // Expose products array for debugging (optional)
    _products: () => products
}
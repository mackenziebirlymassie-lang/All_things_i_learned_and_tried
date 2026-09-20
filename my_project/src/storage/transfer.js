'use strict';
const fs = require('node:fs');
function exportData(value, file) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
function importData(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
module.exports = { exportData, importData };

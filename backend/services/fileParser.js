const path = require('path');

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function normalizeText(text) {
  return (text || '').toString().trim().replace(/[\s_\-\.]+/g, ' ').toLowerCase();
}

function findMonth(text) {
  const normalized = normalizeText(text);
  for (const month of monthNames) {
    if (normalized.includes(month.toLowerCase())) {
      return month;
    }
  }
  return null;
}

function findYear(text) {
  const matches = text.match(/(20\d{2})/g);
  if (matches && matches.length) {
    return matches[0];
  }
  return null;
}

function parseFileName(filename) {
  const baseName = path.basename(filename, path.extname(filename));
  const month = findMonth(baseName) || monthNames[new Date().getMonth()];
  const year = findYear(baseName) || new Date().getFullYear().toString();
  const sheetName = `${month.toUpperCase()} Sales Plan ${year}`;
  return { month, year, sheetName };
}

function isExcelFile(filename) {
  const extension = path.extname(filename).toLowerCase();
  return extension === '.xlsx' || extension === '.xls';
}

module.exports = {
  parseFileName,
  isExcelFile
};

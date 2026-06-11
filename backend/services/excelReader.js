const XLSX = require('xlsx');

/**
 * Reads an Excel workbook and returns the XLSX Workbook object.
 * Enables cellFormula and cellNF to preserve formulas and formatting.
 * @param {string} filePath 
 * @returns {XLSX.Workbook}
 */
function readWorkbook(filePath) {
  return XLSX.readFile(filePath, {
    cellFormula: true,
    cellStyles: true,
    cellNF: true,
    sheetStubs: true
  });
}

/**
 * Returns sheet data including headers, raw rows, and the sheet object.
 * @param {XLSX.Workbook} workbook 
 * @param {string} sheetName 
 * @param {number} headerRow - 1-based index
 * @param {number} dataStartRow - 1-based index
 * @returns {object}
 */
function getSheetData(workbook, sheetName, headerRow = 1, dataStartRow = 2) {
  const selectedSheetName = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[selectedSheetName];
  if (!sheet) {
    throw new Error(`Sheet "${selectedSheetName}" not found in workbook.`);
  }

  // Convert to 2D array representing the full sheet
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // 1-based indexing correction
  const headerIdx = headerRow - 1;
  const dataStartIdx = dataStartRow - 1;

  const headers = (rawRows[headerIdx] || []).map(h => String(h || '').trim());
  const rows = rawRows.slice(dataStartIdx);

  return {
    headers,
    rows,
    sheet,
    sheetName: selectedSheetName
  };
}

/**
 * Retrieves lists of sheet names in the workbook.
 * @param {string} filePath 
 * @returns {string[]}
 */
function getSheetNames(filePath) {
  const workbook = XLSX.readFile(filePath);
  return workbook.SheetNames;
}

module.exports = {
  readWorkbook,
  getSheetData,
  getSheetNames
};

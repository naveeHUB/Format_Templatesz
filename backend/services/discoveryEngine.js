const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Main discovery orchestrator
 * @param {string} filePath - Path to uploaded Excel file
 * @returns {object} Template model with discovered structure
 */
async function discoverTemplate(filePath) {
  try {
    console.log('[DiscoveryEngine] Starting discovery for:', filePath);
    
    // Read workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const fileName = path.basename(filePath);
    const sheets = [];
    
    // Process each worksheet
    for (const worksheet of workbook.worksheets) {
      console.log(`[DiscoveryEngine] Analyzing sheet: ${worksheet.name}`);
      const sheetInfo = await analyzeWorksheet(worksheet);
      sheets.push(sheetInfo);
    }
    
    const result = {
      templateId: uuidv4(),
      fileName: fileName,
      detectedAt: new Date().toISOString(),
      sheets: sheets
    };
    
    console.log(`[DiscoveryEngine] Discovery complete. Found ${sheets.length} sheets`);
    return result;
  } catch (error) {
    console.error('[DiscoveryEngine] Error:', error);
    throw new Error(`Failed to discover template: ${error.message}`);
  }
}

/**
 * Analyze a single worksheet
 */
async function analyzeWorksheet(worksheet) {
  const sheetName = worksheet.name;
  
  // Get first 30 rows for analysis
  const actualRows = [];
  const maxRows = Math.min(30, worksheet.rowCount);
  
  for (let i = 1; i <= maxRows; i++) {
    const row = worksheet.getRow(i);
    const rowValues = [];
    for (let j = 1; j <= 50; j++) {
      const cell = row.getCell(j);
      let value = cell.value;
      if (value && typeof value === 'object') {
        value = value.text || value.result || null;
      }
      rowValues.push(value);
    }
    actualRows.push(rowValues);
  }
  
  // Detect header row
  const headerRow = detectHeaderRow(actualRows);
  
  // Detect data start row
  const dataStartRow = detectDataStartRow(actualRows, headerRow);
  
  // Detect data end row
  const dataEndRow = detectDataEndRow(worksheet, dataStartRow);
  
  // Extract fields
  const fields = extractFields(actualRows[headerRow - 1], headerRow);
  
  // Detect formula columns
  const formulaFields = await detectFormulaColumns(worksheet, dataStartRow, dataEndRow);
  
  // Detect merged cells
  const mergedCells = detectMergedCells(worksheet);
  
  // Get column widths
  const columnWidths = getColumnWidths(worksheet);
  
  // Detect summary sections
  const summarySections = detectSummarySections(worksheet, dataEndRow);
  
  // Detect data region
  const dataRegion = detectDataRegion(worksheet, headerRow, dataStartRow, dataEndRow);
  
  return {
    name: sheetName,
    headerRow: headerRow,
    dataStartRow: dataStartRow,
    dataEndRow: dataEndRow,
    dataRegion: dataRegion,
    fields: fields,
    formulaFields: formulaFields,
    mergedCells: mergedCells,
    columnWidths: columnWidths,
    summarySections: summarySections,
    totalRows: worksheet.rowCount,
    totalColumns: worksheet.columnCount
  };
}

/**
 * Detect which row contains headers
 */
function detectHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    let textCount = 0;
    let totalCount = 0;
    
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell !== null && cell !== undefined && cell !== '') {
        totalCount++;
        if (typeof cell === 'string' && cell.length > 0 && !cell.match(/^\d+$/)) {
          textCount++;
        }
      }
    }
    
    if (totalCount > 0 && (textCount / totalCount) > 0.5) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Detect first row with actual data after header
 */
function detectDataStartRow(rows, headerRow) {
  const startIdx = headerRow;
  
  if (startIdx >= rows.length) {
    return startIdx + 1;
  }
  
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    let nonEmptyCount = 0;
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell !== null && cell !== undefined && cell !== '') {
        nonEmptyCount++;
      }
    }
    
    if (nonEmptyCount > 2) {
      return i + 1;
    }
  }
  
  return startIdx + 1;
}

/**
 * Detect last row with data
 */
function detectDataEndRow(worksheet, dataStartRow) {
  let lastRowWithData = dataStartRow;
  
  for (let i = dataStartRow; i <= worksheet.rowCount && i <= dataStartRow + 1000; i++) {
    const row = worksheet.getRow(i);
    let hasData = false;
    
    for (let j = 1; j <= 20; j++) {
      const cell = row.getCell(j);
      const value = cell.value;
      if (value !== null && value !== undefined && value !== '') {
        hasData = true;
        break;
      }
    }
    
    if (hasData) {
      lastRowWithData = i;
    } else {
      break;
    }
  }
  
  return lastRowWithData;
}

/**
 * Extract field names from header row
 */
function extractFields(headerRowValues, headerRowIndex) {
  const fields = [];
  
  if (!headerRowValues) return fields;
  
  for (let i = 0; i < headerRowValues.length; i++) {
    let fieldName = headerRowValues[i];
    
    if (fieldName === null || fieldName === undefined) {
      continue;
    }
    
    fieldName = String(fieldName).trim();
    
    if (fieldName === '') {
      continue;
    }
    
    const columnLetter = getColumnLetter(i);
    
    fields.push({
      id: `field_${i}_${Date.now()}`,
      name: fieldName,
      column: columnLetter,
      columnIndex: i,
      required: false,
      detected: true,
      sampleValues: []
    });
  }
  
  return fields;
}

/**
 * Detect columns that contain formulas
 */
async function detectFormulaColumns(worksheet, dataStartRow, dataEndRow) {
  const formulaFields = [];
  
  if (dataStartRow > dataEndRow) return formulaFields;
  
  const maxRowsToCheck = Math.min(5, dataEndRow - dataStartRow + 1);
  
  for (let col = 1; col <= 50; col++) {
    let hasFormula = false;
    let formulaExample = null;
    
    for (let row = dataStartRow; row < dataStartRow + maxRowsToCheck; row++) {
      const cell = worksheet.getCell(row, col);
      if (cell.formula) {
        hasFormula = true;
        formulaExample = cell.formula;
        break;
      }
    }
    
    if (hasFormula) {
      const colLetter = getColumnLetter(col - 1);
      formulaFields.push({
        column: colLetter,
        columnIndex: col,
        formula: formulaExample,
        description: 'Calculated field'
      });
    }
  }
  
  return formulaFields;
}

/**
 * Detect merged cells in worksheet
 */
function detectMergedCells(worksheet) {
  const mergedCells = [];
  
  if (!worksheet.model.merges) return mergedCells;
  
  for (const merge of worksheet.model.merges) {
    mergedCells.push({
      range: merge,
      topLeft: merge.split(':')[0],
      bottomRight: merge.split(':')[1]
    });
  }
  
  return mergedCells;
}

/**
 * Get column widths
 */
function getColumnWidths(worksheet) {
  const widths = {};
  
  for (let col = 1; col <= worksheet.columnCount && col <= 50; col++) {
    const column = worksheet.getColumn(col);
    if (column.width) {
      const colLetter = getColumnLetter(col - 1);
      widths[colLetter] = column.width;
    }
  }
  
  return widths;
}

/**
 * Detect summary sections
 */
function detectSummarySections(worksheet, dataEndRow) {
  const summarySections = [];
  
  const startCheckRow = dataEndRow + 1;
  const endCheckRow = Math.min(worksheet.rowCount, dataEndRow + 20);
  
  for (let row = startCheckRow; row <= endCheckRow; row++) {
    const worksheetRow = worksheet.getRow(row);
    let hasTextHeaders = false;
    let hasNumbers = false;
    
    for (let col = 1; col <= 10; col++) {
      const cell = worksheetRow.getCell(col);
      const value = cell.value;
      
      if (value && typeof value === 'string') {
        const valueStr = value.toString().toLowerCase();
        if (valueStr.includes('total') || valueStr.includes('summary') || valueStr.includes('subtotal')) {
          hasTextHeaders = true;
        }
      } else if (value && typeof value === 'number') {
        hasNumbers = true;
      }
    }
    
    if (hasTextHeaders && hasNumbers) {
      const colLetter = getColumnLetter(0);
      summarySections.push({
        location: `${colLetter}${row}`,
        type: 'summary_row',
        confidence: 'high'
      });
    }
  }
  
  return summarySections;
}

/**
 * Detect the main data region boundaries
 */
function detectDataRegion(worksheet, headerRow, dataStartRow, dataEndRow) {
  let maxColumn = 0;
  
  const checkRow = Math.min(headerRow, dataStartRow);
  const row = worksheet.getRow(checkRow);
  
  for (let col = 1; col <= 100; col++) {
    const cell = row.getCell(col);
    const value = cell.value;
    if (value !== null && value !== undefined && value !== '') {
      maxColumn = col;
    } else if (maxColumn > 0 && col > maxColumn + 5) {
      break;
    }
  }
  
  const startColLetter = getColumnLetter(0);
  const endColLetter = getColumnLetter(maxColumn - 1);
  
  return {
    startRow: headerRow,
    endRow: dataEndRow,
    startColumn: 1,
    endColumn: maxColumn,
    range: `${startColLetter}${headerRow}:${endColLetter}${dataEndRow}`
  };
}

/**
 * Helper: Get column letter from index (0=A, 1=B, etc.)
 */
function getColumnLetter(index) {
  let letter = '';
  let num = index;
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26) - 1;
  }
  return letter;
}

module.exports = {
  discoverTemplate
};
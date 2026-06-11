const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * Shifts Excel cell references in a formula to reference a new row.
 * E.g., shifts "=IF(AND(J2<>"",I2<>""...), J2*I2)" from row 2 to row 3 -> "=IF(AND(J3<>"",I3<>""...), J3*I3)"
 * Handles relative and absolute cell references.
 */
function shiftFormula(formula, templateRow, targetRow) {
  if (!formula) return formula;
  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (match, colAbs, col, rowAbs, rowStr) => {
    const row = parseInt(rowStr, 10);
    // Only shift if it refers to the template row, and the row reference is not absolute (i.e., rowAbs !== '$')
    if (row === templateRow && rowAbs !== '$') {
      return colAbs + col + rowAbs + targetRow;
    }
    return match;
  });
}

/**
 * Updates the '!ref' range of a worksheet dynamically based on all cells present.
 */
function updateSheetRange(sheet) {
  const keys = Object.keys(sheet).filter(k => k[0] !== '!');
  if (keys.length === 0) return;
  let minCol = Infinity, maxCol = -Infinity;
  let minRow = Infinity, maxRow = -Infinity;
  keys.forEach(k => {
    const cell = XLSX.utils.decode_cell(k);
    if (cell.c < minCol) minCol = cell.c;
    if (cell.c > maxCol) maxCol = cell.c;
    if (cell.c < minRow) minRow = cell.c;
    if (cell.c > maxRow) maxRow = cell.c;
  });
  sheet['!ref'] = XLSX.utils.encode_range({
    s: { c: minCol, r: minRow },
    e: { c: maxCol, r: maxRow }
  });
}

/**
 * Helper to convert cell value to correct type.
 */
function parseCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const strVal = String(value).trim();
  // Check if it's a number
  const numVal = Number(strVal.replace(/,/g, ''));
  if (strVal !== '' && !isNaN(numVal)) {
    return numVal;
  }
  return strVal;
}

/**
 * Generates the output Excel workbook using the template and injected data.
 */
async function generateExcel({
  templateConfig,
  mappedRows,
  templateWorkbook,
  templateHeaders,
  outputFilePath,
  customSheetName
}) {
  // 1. Rename sheet in workbook if customSheetName is provided
  const oldSheetName = templateConfig.sheetName || templateWorkbook.SheetNames[0];
  const newSheetName = customSheetName || oldSheetName;
  const sheet = templateWorkbook.Sheets[oldSheetName];
  if (!sheet) {
    throw new Error(`Template sheet "${oldSheetName}" not found.`);
  }

  if (oldSheetName !== newSheetName) {
    const idx = templateWorkbook.SheetNames.indexOf(oldSheetName);
    if (idx !== -1) {
      templateWorkbook.SheetNames[idx] = newSheetName;
      templateWorkbook.Sheets[newSheetName] = sheet;
      delete templateWorkbook.Sheets[oldSheetName];
    }
  }

  const dataStartRow = templateConfig.dataStartRow || 2;
  const templateRowIdx = dataStartRow; // 1-based template row containing formulas/styles

  // 2. Identify formula columns and style info from the first data row in the template
  const columnProps = {};
  templateHeaders.forEach((tHeader, cIdx) => {
    const colLetter = XLSX.utils.encode_col(cIdx);
    const cellRef = colLetter + templateRowIdx;
    const cell = sheet[cellRef];
    columnProps[tHeader] = {
      colIdx: cIdx,
      colLetter,
      hasFormula: !!(cell && cell.f),
      formula: cell ? cell.f : null,
      z: cell ? cell.z : null,
      s: cell ? cell.s : null
    };
  });

  // 3. Inject mapped rows
  mappedRows.forEach((row, rIdx) => {
    const targetRow = dataStartRow + rIdx;

    templateHeaders.forEach(tHeader => {
      const prop = columnProps[tHeader];
      if (!prop) return;

      const targetCellRef = prop.colLetter + targetRow;
      
      // If the template has a formula for this cell, propagate and shift it
      if (prop.hasFormula) {
        const shiftedFormula = shiftFormula(prop.formula, templateRowIdx, targetRow);
        sheet[targetCellRef] = {
          t: 'n',
          f: shiftedFormula,
          v: 0
        };
      } else {
        // Otherwise, write the value mapped from input data
        const val = parseCellValue(row[tHeader]);
        if (typeof val === 'number') {
          sheet[targetCellRef] = { t: 'n', v: val };
        } else {
          sheet[targetCellRef] = { t: 's', v: val };
        }
      }

      // Copy formatting property (z) from template cell if available
      if (prop.z && sheet[targetCellRef]) {
        sheet[targetCellRef].z = prop.z;
      }
    });
  });

  // 4. Clear unused template placeholder rows in the main data columns
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A2');
  const maxRow = range.e.r + 1; // 1-based index
  const startRowToClear = dataStartRow + mappedRows.length;
  if (startRowToClear <= maxRow) {
    for (let r = startRowToClear; r <= maxRow; r++) {
      templateHeaders.forEach((_, cIdx) => {
        const colLetter = XLSX.utils.encode_col(cIdx);
        const cellRef = colLetter + r;
        // Make sure we only delete it if it is part of the data table (not formulas/summary on the right)
        delete sheet[cellRef];
      });
    }
  }

  // 5. Customer summary generation
  const summaryConfig = templateConfig.summary;
  const summaryRows = [];
  if (summaryConfig && summaryConfig.enabled) {
    let summarySheetName = summaryConfig.sheetName || newSheetName;
    if (summarySheetName === oldSheetName) {
      summarySheetName = newSheetName;
    }
    const summarySheet = templateWorkbook.Sheets[summarySheetName];
    if (summarySheet) {
      // Calculate summary data in JS (used for return stats and fallback values)
      const customerMap = new Map();
      mappedRows.forEach(row => {
        // Look up customer and value from mapped fields
        const customer = String(row._standardFields.CUSTOMER || row.CUSTOMER || row['CUSTOMER DESC.'] || '').trim();
        // Determine the price/qty to calculate value if not directly present
        const qtyVal = row._standardFields.QTY !== undefined ? row._standardFields.QTY : row['Sales Plan Qty'] || row['SALES PLAN QTY'];
        const priceVal = row._standardFields.PRICE !== undefined ? row._standardFields.PRICE : row['SALES PRICE'] || row['Total price'] || row['USD/EUR value'];

        const qty = parseFloat(String(qtyVal).replace(/,/g, '')) || 0;
        const price = parseFloat(String(priceVal).replace(/,/g, '')) || 0;
        
        // Value: if the row contains a custom Sale Plan Value column, use it, otherwise qty * price / 100000 (standard formula)
        let rowValue = 0;
        const customValue = row['Sale Plan Value'] || row['SALE PLAN VALUE'] || row['Sales Plan Value'];
        if (customValue !== undefined && customValue !== '') {
          rowValue = parseFloat(String(customValue).replace(/,/g, '')) || 0;
        } else {
          rowValue = (qty * price) / 100000;
        }

        if (customer) {
          customerMap.set(customer, (customerMap.get(customer) || 0) + rowValue);
        }
      });

      // Sort summary rows descending by total value
      const sortedSummary = Array.from(customerMap.entries())
        .map(([customer, totalValue]) => ({ customer, totalValue }))
        .sort((a, b) => b.totalValue - a.totalValue);

      // Write summary to the sheet starting at startCol and startRow
      const startColLetter = summaryConfig.startCol || 'I';
      const startColIdx = XLSX.utils.decode_col(startColLetter);
      const startRowIdx = summaryConfig.startRow || 1; // 1-based

      // Write Headers
      const custHeaderRef = startColLetter + startRowIdx;
      const valHeaderRef = XLSX.utils.encode_col(startColIdx + 1) + startRowIdx;
      
      summarySheet[custHeaderRef] = { t: 's', v: summaryConfig.customerHeader || 'Customer' };
      summarySheet[valHeaderRef] = { t: 's', v: summaryConfig.valueHeader || 'Sum of Sale Plan Value' };

      // Write Rows
      // Find the columns for CUSTOMER and sales value dynamically to construct SUMIF formulas
      const customerColIdx = templateHeaders.findIndex(h => h.toUpperCase().includes('CUSTOMER') && !h.toUpperCase().includes('DESC'));
      // Use the Sale Plan Value or SALES PLAN VALUE column header index
      const valueColIdx = templateHeaders.findIndex(h => h.toUpperCase().includes('VALUE') || h.toUpperCase().includes('TOTAL PRICE'));

      const hasColIdxs = customerColIdx !== -1 && valueColIdx !== -1;
      const dataEndExcelRow = dataStartRow + mappedRows.length - 1;

      sortedSummary.forEach((item, index) => {
        const rNum = startRowIdx + 1 + index;
        const cCellRef = startColLetter + rNum;
        const vCellRef = XLSX.utils.encode_col(startColIdx + 1) + rNum;

        summarySheet[cCellRef] = { t: 's', v: item.customer };

        if (hasColIdxs && mappedRows.length > 0) {
          const custColLetter = XLSX.utils.encode_col(customerColIdx);
          const valColLetter = XLSX.utils.encode_col(valueColIdx);
          // Excel formula: =SUMIF($A$2:$A$15, I3, $F$2:$F$15)
          const sumifFormula = `SUMIF($${custColLetter}$${dataStartRow}:$${custColLetter}$${dataEndExcelRow},${cCellRef},$${valColLetter}$${dataStartRow}:$${valColLetter}$${dataEndExcelRow})`;
          summarySheet[vCellRef] = {
            t: 'n',
            f: sumifFormula,
            v: 0,
            z: '[$$-409]#,##0.00;[Red]-[$$-409]#,##0.00' // Apply Currency format
          };
        } else {
          // Fallback to JS computed value if columns cannot be mapped
          summarySheet[vCellRef] = {
            t: 'n',
            v: item.totalValue,
            z: '[$$-409]#,##0.00;[Red]-[$$-409]#,##0.00'
          };
        }

        summaryRows.push({
          customer: item.customer,
          totalValue: item.totalValue
        });
      });

      // Clear any potential leftover summary rows from the template
      const maxSummaryRows = 1000; // safe limit
      const startRowToClearSummary = startRowIdx + 1 + sortedSummary.length;
      for (let r = startRowToClearSummary; r < startRowToClearSummary + maxSummaryRows; r++) {
        const cCellRef = startColLetter + r;
        const vCellRef = XLSX.utils.encode_col(startColIdx + 1) + r;
        if (summarySheet[cCellRef]) {
          delete summarySheet[cCellRef];
          delete summarySheet[vCellRef];
        } else {
          break; // Stop clearing when we hit empty space
        }
      }
    }
  }

  // 6. Recalculate range and save the workbook
  updateSheetRange(sheet);
  XLSX.writeFile(templateWorkbook, outputFilePath);

  return {
    summaryRows
  };
}

module.exports = {
  generateExcel,
  shiftFormula
};

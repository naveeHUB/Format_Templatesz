/**
 * Maps raw input rows (from 2D array format) to the template column structure
 * based on template-specific mappings and case-insensitive header fallback.
 * 
 * @param {Array[]} inputRows - Raw data rows from input sheet
 * @param {string[]} inputHeaders - Headers from input sheet
 * @param {object} mappingConfig - Template mapping configuration (templateColName: inputColName)
 * @param {string[]} templateHeaders - Column headers of the template sheet
 * @returns {object[]} Array of mapped row objects keyed by template header names
 */
function mapInputData(inputRows, inputHeaders, mappingConfig = {}, templateHeaders = []) {
  // Build a map from input header to index in 2D array
  const inputHeaderMap = {};
  inputHeaders.forEach((h, index) => {
    if (h !== undefined && h !== null && h !== '') {
      inputHeaderMap[String(h).trim().toLowerCase()] = index;
    }
  });

  // Resolve mapping for all template headers
  // E.g., templateHeader -> input index
  const resolvedMapping = {};
  
  templateHeaders.forEach(tHeader => {
    const tHeaderStr = String(tHeader).trim();
    const tHeaderLower = tHeaderStr.toLowerCase();
    
    // 1. Check if registry explicitly maps this template column to a specific input column
    let targetInputCol = mappingConfig[tHeaderStr] || mappingConfig[tHeaderLower];
    
    // 2. If no explicit mapping, fallback to case-insensitive header match
    if (!targetInputCol) {
      targetInputCol = tHeaderStr;
    }

    const inputIdx = inputHeaderMap[targetInputCol.toLowerCase()];
    if (inputIdx !== undefined && inputIdx !== null) {
      resolvedMapping[tHeaderStr] = inputIdx;
    }
  });

  // For domain keys that are mapped (like QTY, PRICE etc. in the prompt),
  // make sure they are matched to their columns too, in case they are used in business logic.
  // Prompt: CUSTOMER: "CUSTOMER", ITEM: "ITEM", QTY: "SALES_PLAN_QTY", PRICE: "TOTAL_PRICE"
  // Let's also keep track of standard fields mapping
  const standardFieldsMapping = {};
  for (const [domainKey, inputColName] of Object.entries(mappingConfig)) {
    const inputIdx = inputHeaderMap[String(inputColName).trim().toLowerCase()];
    if (inputIdx !== undefined && inputIdx !== null) {
      standardFieldsMapping[domainKey] = inputIdx;
    }
  }

  // Perform mapping for each row
  return inputRows
    .filter(row => row && row.some(cell => String(cell || '').trim() !== '')) // skip completely empty rows
    .map((row, rowIndex) => {
      const mappedRow = {
        _rowIndex: rowIndex + 2, // for validation reports
        _standardFields: {}
      };

      // Map to template column headers
      for (const [tHeader, idx] of Object.entries(resolvedMapping)) {
        mappedRow[tHeader] = row[idx] !== undefined ? row[idx] : '';
      }

      // Map to standard domain keys
      for (const [domainKey, idx] of Object.entries(standardFieldsMapping)) {
        mappedRow._standardFields[domainKey] = row[idx] !== undefined ? row[idx] : '';
      }

      return mappedRow;
    });
}

module.exports = {
  mapInputData
};

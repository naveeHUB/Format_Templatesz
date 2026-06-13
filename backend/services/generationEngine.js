const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Dynamic Generation Engine - Phase 6
 * Generates Excel workbook using template registry and mapping profile
 */

/**
 * Get column letter from index (0=A, 1=B, etc.)
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

/**
 * Shift formula row references
 * @param {string} formula - Original formula
 * @param {number} sourceRow - Source row number in template
 * @param {number} targetRow - Target row number for new data
 * @returns {string} Shifted formula
 */
function shiftFormula(formula, sourceRow, targetRow) {
    if (!formula) return formula;
    
    const shift = targetRow - sourceRow;
    if (shift === 0) return formula;
    
    // Shift row numbers in cell references (e.g., A2 -> A5)
    return formula.replace(/([A-Z]+)(\d+)/gi, (match, col, row) => {
        const newRow = parseInt(row, 10) + shift;
        return `${col}${newRow}`;
    });
}

/**
 * Parse cell value to appropriate type
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
 * Main generation function
 * @param {object} params - Generation parameters
 * @param {string} params.templateId - Template ID from registry
 * @param {string} params.sourceFilePath - Path to source Excel file
 * @param {string} params.outputFilePath - Path for output file
 * @param {object} params.template - Template object (optional, will fetch if not provided)
 * @param {object} params.mappingProfile - Mapping profile (optional, will fetch if not provided)
 * @returns {object} Generation result
 */
async function generateDynamicWorkbook({ templateId, sourceFilePath, outputFilePath, template, mappingProfile }) {
    console.log(`[GenerationEngine] Starting dynamic generation for template: ${templateId}`);
    
    // 1. Load template and mapping if not provided
    let templateData = template;
    let mappingData = mappingProfile;
    
    if (!templateData) {
        const registry = require('./templateRegistry');
        templateData = registry.getTemplateById(templateId);
        if (!templateData) {
            throw new Error(`Template not found: ${templateId}`);
        }
    }
    
    if (!mappingData && templateData.mappingProfile) {
        mappingData = templateData.mappingProfile;
    }
    
    if (!mappingData || !mappingData.mappingConfig) {
        throw new Error(`No approved mapping profile found for template: ${templateId}`);
    }
    
    // 2. Get template sheet info
    const templateSheet = templateData.sheets[0];
    const sheetName = templateSheet.name;
    const headerRow = templateSheet.headerRow || 1;
    const dataStartRow = templateSheet.dataStartRow || 2;
    
    // 3. Read template workbook (the actual Excel file)
    // The template file should be stored in uploads/templates/
    const templateFilePath = path.join(__dirname, '..', 'uploads', 'templates', `${templateData.sourceFile}`);
    
    if (!fs.existsSync(templateFilePath)) {
        throw new Error(`Template file not found: ${templateFilePath}`);
    }
    
    const templateWorkbook = XLSX.readFile(templateFilePath, {
        cellFormula: true,
        cellStyles: true,
        cellNF: true
    });
    
    const sheet = templateWorkbook.Sheets[sheetName];
    if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found in template`);
    }
    
    // 4. Read source data
    const sourceWorkbook = XLSX.readFile(sourceFilePath);
    const sourceSheetName = sourceWorkbook.SheetNames[0];
    const sourceSheet = sourceWorkbook.Sheets[sourceSheetName];
    const sourceData = XLSX.utils.sheet_to_json(sourceSheet, { header: 1, defval: '' });
    
    if (!sourceData || sourceData.length < 2) {
        throw new Error('Source file has no data rows');
    }
    
    // 5. Get source headers and mapping config
    const sourceHeaders = sourceData[0].map(h => String(h || '').trim());
    const mappingConfig = mappingData.mappingConfig;
    
    // Build column index map for source
    const sourceColumnMap = {};
    for (const [targetField, sourceField] of Object.entries(mappingConfig)) {
        const colIndex = sourceHeaders.findIndex(h => h === sourceField);
        if (colIndex !== -1) {
            sourceColumnMap[targetField] = colIndex;
        }
    }
    
    // 6. Get template column mapping
    const templateFields = templateSheet.fields;
    const templateColumnMap = {};
    for (const field of templateFields) {
        templateColumnMap[field.name] = field.columnIndex;
    }
    
    // 7. Process data rows
    const dataRows = sourceData.slice(1); // Skip header
    const templateRowIndex = dataStartRow;
    
    // Get formula information from template's first data row
    const formulaMap = {};
    const styleMap = {};
    
    // Check template's data row for formulas
    const formulaRowNum = templateRowIndex;
    for (const field of templateFields) {
        const colLetter = getColumnLetter(field.columnIndex);
        const cellRef = `${colLetter}${formulaRowNum}`;
        const cell = sheet[cellRef];
        
        if (cell && cell.f) {
            formulaMap[field.name] = {
                formula: cell.f,
                sourceRow: formulaRowNum
            };
        }
        if (cell && cell.z) {
            styleMap[field.name] = cell.z; // Number format
        }
    }
    
    // 8. Write data rows
    let rowOffset = 0;
    const maxRows = Math.min(dataRows.length, 1000); // Limit for performance
    
    for (let i = 0; i < maxRows; i++) {
        const sourceRow = dataRows[i];
        const targetRowNum = templateRowIndex + i;
        
        for (const field of templateFields) {
            const colLetter = getColumnLetter(field.columnIndex);
            const cellRef = `${colLetter}${targetRowNum}`;
            
            // Check if this field has a formula
            const formulaInfo = formulaMap[field.name];
            if (formulaInfo) {
                // Shift formula for this row
                const shiftedFormula = shiftFormula(
                    formulaInfo.formula,
                    formulaInfo.sourceRow,
                    targetRowNum
                );
                sheet[cellRef] = {
                    t: 'n',
                    f: shiftedFormula,
                    v: 0
                };
            } else {
                // Get value from source using mapping
                const sourceColIndex = sourceColumnMap[field.name];
                let value = '';
                
                if (sourceColIndex !== undefined && sourceRow[sourceColIndex] !== undefined) {
                    value = parseCellValue(sourceRow[sourceColIndex]);
                }
                
                // Write value
                if (typeof value === 'number') {
                    sheet[cellRef] = { t: 'n', v: value };
                } else if (value && value !== '') {
                    sheet[cellRef] = { t: 's', v: String(value) };
                } else {
                    sheet[cellRef] = { t: 's', v: '' };
                }
                
                // Apply style if available
                if (styleMap[field.name] && sheet[cellRef]) {
                    sheet[cellRef].z = styleMap[field.name];
                }
            }
        }
        
        rowOffset++;
    }
    
    // 9. Clean up unused template rows
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A2');
    const maxRow = range.e.r + 1;
    const startRowToClear = templateRowIndex + maxRows;
    
    if (startRowToClear <= maxRow) {
        for (let r = startRowToClear; r <= maxRow; r++) {
            for (const field of templateFields) {
                const colLetter = getColumnLetter(field.columnIndex);
                const cellRef = `${colLetter}${r}`;
                delete sheet[cellRef];
            }
        }
    }
    
    // 10. Update sheet range
    updateSheetRange(sheet);
    
    // 11. Preserve merged cells from template
    if (templateSheet.mergedCells && templateSheet.mergedCells.length > 0) {
        if (!sheet['!merges']) {
            sheet['!merges'] = [];
        }
        for (const merge of templateSheet.mergedCells) {
            // Parse merge range (e.g., "A1:C1")
            const parts = merge.range.split(':');
            if (parts.length === 2) {
                const s = XLSX.utils.decode_cell(parts[0]);
                const e = XLSX.utils.decode_cell(parts[1]);
                sheet['!merges'].push({ s: s, e: e });
            }
        }
    }
    
    // 12. Preserve column widths
    if (templateSheet.columnWidths && Object.keys(templateSheet.columnWidths).length > 0) {
        sheet['!cols'] = [];
        for (const [colLetter, width] of Object.entries(templateSheet.columnWidths)) {
            const colIndex = colLetter.charCodeAt(0) - 65;
            sheet['!cols'][colIndex] = { wch: width };
        }
    }
    
    // 13. Write output file
    XLSX.writeFile(templateWorkbook, outputFilePath);
    
    console.log(`[GenerationEngine] Generated workbook with ${rowOffset} rows at: ${outputFilePath}`);
    
    return {
        success: true,
        outputPath: outputFilePath,
        rowsProcessed: rowOffset,
        templateId: templateId,
        sheetName: sheetName
    };
}

/**
 * Update sheet range after modifications
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
        if (cell.r < minRow) minRow = cell.r;
        if (cell.r > maxRow) maxRow = cell.r;
    });
    
    sheet['!ref'] = XLSX.utils.encode_range({
        s: { c: minCol, r: minRow },
        e: { c: maxCol, r: maxRow }
    });
}

module.exports = {
    generateDynamicWorkbook,
    shiftFormula,
    parseCellValue
};
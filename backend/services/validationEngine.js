const XLSX = require('xlsx');

/**
 * Validation Engine - Phase 5
 * Validates source data against template requirements
 */

/**
 * Main validation function
 * @param {object} params - Validation parameters
 * @param {string} params.sourceFilePath - Path to source Excel file
 * @param {object} params.template - Template from registry
 * @param {object} params.mappingProfile - Approved mapping profile
 * @returns {object} Validation report
 */
async function validateSourceData({ sourceFilePath, template, mappingProfile }) {
    const report = {
        valid: true,
        errors: [],
        warnings: [],
        statistics: {
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            missingRequiredFields: 0,
            duplicates: 0,
            typeMismatches: 0
        }
    };
    
    try {
        // 1. Load source workbook
        const workbook = XLSX.readFile(sourceFilePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        if (!data || data.length < 2) {
            report.valid = false;
            report.errors.push('Source file has no data rows');
            return report;
        }
        
        // 2. Get headers (first row)
        const sourceHeaders = data[0].map(h => String(h || '').trim());
        
        // 3. Validate mapping exists for required fields
        const requiredFields = template.sheets[0].fields.filter(f => f.required === true);
        const mappingConfig = mappingProfile.mappingConfig || {};
        
        for (const requiredField of requiredFields) {
            const mappedSource = mappingConfig[requiredField.name];
            if (!mappedSource) {
                report.valid = false;
                report.errors.push(`Required field "${requiredField.name}" has no mapping`);
            } else if (!sourceHeaders.includes(mappedSource)) {
                report.valid = false;
                report.errors.push(`Mapped source column "${mappedSource}" for required field "${requiredField.name}" not found in source file`);
            }
        }
        
        // 4. Get column indices for mapped fields
        const columnIndices = {};
        for (const [targetField, sourceField] of Object.entries(mappingConfig)) {
            const index = sourceHeaders.findIndex(h => h === sourceField);
            if (index !== -1) {
                columnIndices[targetField] = index;
            } else {
                report.warnings.push(`Source column "${sourceField}" not found for field "${targetField}"`);
            }
        }
        
        // 5. Validate each data row
        const dataRows = data.slice(1); // Skip header row
        report.statistics.totalRows = dataRows.length;
        
        const rowKeys = new Set(); // For duplicate detection
        let rowNumber = 2; // Excel row number (1-based with header at row 1)
        
        for (const row of dataRows) {
            let rowValid = true;
            const rowErrors = [];
            
            // Check required fields
            for (const requiredField of requiredFields) {
                const colIndex = columnIndices[requiredField.name];
                if (colIndex !== undefined) {
                    const value = row[colIndex];
                    const isEmpty = value === undefined || value === null || String(value).trim() === '';
                    
                    if (isEmpty) {
                        rowValid = false;
                        report.statistics.missingRequiredFields++;
                        rowErrors.push(`Missing required field: ${requiredField.name}`);
                    } else {
                        // Type validation based on field naming
                        const valueStr = String(value).trim();
                        const isNumericField = requiredField.name.toLowerCase().includes('qty') || 
                                               requiredField.name.toLowerCase().includes('value') ||
                                               requiredField.name.toLowerCase().includes('price') ||
                                               requiredField.name.toLowerCase().includes('amount');
                        
                        if (isNumericField && isNaN(parseFloat(valueStr))) {
                            rowValid = false;
                            report.statistics.typeMismatches++;
                            rowErrors.push(`Field "${requiredField.name}" should be numeric, got "${valueStr}"`);
                        }
                    }
                }
            }
            
            // Duplicate detection based on first 3 fields
            const keyFields = Object.keys(mappingConfig).slice(0, 3);
            const key = keyFields.map(field => {
                const colIndex = columnIndices[field];
                return colIndex !== undefined ? String(row[colIndex] || '').trim() : '';
            }).join('|');
            
            if (key && key !== '||') {
                if (rowKeys.has(key)) {
                    rowValid = false;
                    report.statistics.duplicates++;
                    rowErrors.push(`Duplicate row detected (key: ${key})`);
                } else {
                    rowKeys.add(key);
                }
            }
            
            if (rowValid) {
                report.statistics.validRows++;
            } else {
                report.statistics.invalidRows++;
                report.warnings.push({
                    row: rowNumber,
                    errors: rowErrors
                });
            }
            
            rowNumber++;
        }
        
        // Determine overall validity
        report.valid = report.statistics.invalidRows === 0 && report.errors.length === 0;
        
        // Add summary
        report.statistics.validityPercentage = report.statistics.totalRows > 0 
            ? Math.round((report.statistics.validRows / report.statistics.totalRows) * 100)
            : 0;
        
    } catch (error) {
        console.error('[ValidationEngine] Error:', error);
        report.valid = false;
        report.errors.push(`Validation failed: ${error.message}`);
    }
    
    return report;
}

/**
 * Quick validation without full file read
 * @param {object} params - Parameters
 * @returns {object} Quick validation result
 */
function quickValidate({ sourceHeaders, template, mappingProfile }) {
    const result = {
        valid: true,
        missingMappings: [],
        missingColumns: []
    };
    
    const requiredFields = template.sheets[0].fields.filter(f => f.required === true);
    const mappingConfig = mappingProfile.mappingConfig || {};
    
    for (const requiredField of requiredFields) {
        const mappedSource = mappingConfig[requiredField.name];
        if (!mappedSource) {
            result.valid = false;
            result.missingMappings.push(requiredField.name);
        } else if (!sourceHeaders.includes(mappedSource)) {
            result.valid = false;
            result.missingColumns.push(mappedSource);
        }
    }
    
    return result;
}

module.exports = {
    validateSourceData,
    quickValidate
};
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

class LegacyTransformationService {
    constructor() {
        this.generatedDir = path.join(__dirname, '../uploads/generated');
        if (!fs.existsSync(this.generatedDir)) {
            fs.mkdirSync(this.generatedDir, { recursive: true });
        }
    }
    
    async transformData(sourceFilePath, templateId, mappings, options = {}) {
        console.time('TRANSFORM');
        console.log('START TRANSFORM');
        console.log('SOURCE FILE PATH:', sourceFilePath);
        console.log('TEMPLATE ID:', templateId);
        console.log('MAPPINGS COUNT:', Object.keys(mappings).length);
        
        // Load template structure
        const templateFile = path.join(__dirname, `../data/templates/${templateId}.json`);
        console.log('TEMPLATE STRUCTURE FILE:', templateFile);
        const templateStructure = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
        
        // Load source workbook
        const sourceWorkbook = new ExcelJS.Workbook();
        await sourceWorkbook.xlsx.readFile(sourceFilePath);
        
        // Load template workbook (original uploaded template)
        const templateWorkbookPath = path.join(__dirname, `../uploads/templates/${templateId}.xlsx`);
        console.log('TEMPLATE WORKBOOK PATH:', templateWorkbookPath);
        const templateWorkbook = new ExcelJS.Workbook();
        await templateWorkbook.xlsx.readFile(templateWorkbookPath);
        
        // Process each sheet according to template configuration
        for (const sheetConfig of templateStructure.sheets) {
            const sourceSheet = sourceWorkbook.getWorksheet(1); // Use first sheet from source
            const targetSheet = templateWorkbook.getWorksheet(sheetConfig.sheetName);
            if (sourceSheet && targetSheet) {
                await this.transformSheet(sourceSheet, targetSheet, sheetConfig, mappings, options);
            }
        }
        
        // Determine output format (must be Excel in Phase 1)
        const requestedFormat = options.outputFormat ? options.outputFormat.toLowerCase() : 'xlsx';
        if (requestedFormat !== 'xlsx') {
            throw new Error('Only Excel output is supported in Phase 1');
        }
        const format = 'xlsx';
        const timestamp = Date.now();
        const outputFilename = `output_${timestamp}.${format}`;
        const outputPath = path.join(this.generatedDir, outputFilename);
        console.log('OUTPUT FORMAT:', format);
        console.log('OUTPUT PATH:', outputPath);
        
        // Generate Excel output
        await templateWorkbook.xlsx.writeFile(outputPath);
        
        // Verify file creation and size
        if (!fs.existsSync(outputPath)) {
            throw new Error('Output file was not created');
        }
        const fileSize = fs.statSync(outputPath).size;
        if (fileSize === 0) {
            throw new Error('Generated output file is empty');
        }
        console.log('OUTPUT FILE CREATED, SIZE (bytes):', fileSize);
        console.timeEnd('TRANSFORM');
        
        return {
            success: true,
            outputFilename: outputFilename,
            outputPath: outputPath,
            fileSize: fileSize,
            outputFormat: format
        };
    }
    
    async transformSheet(sourceSheet, targetSheet, sheetConfig, mappings, options) {
        // Extract data from source sheet
        const sourceData = await this.extractSourceData(sourceSheet, sheetConfig.headers);
        
        // Apply mappings
        const mappedData = this.applyMappingsToData(sourceData, mappings);
        
        // Clear existing data rows (preserve header and formulas)
        this.clearDataRows(targetSheet, sheetConfig);
        
        // Write mapped data to target sheet
        await this.writeDataToSheet(targetSheet, mappedData, sheetConfig);
        
        // Preserve formatting and formulas
        await this.preserveFormulas(targetSheet, sheetConfig);
        await this.preserveFormatting(targetSheet, sheetConfig);
        await this.preserveMergedCells(targetSheet, sheetConfig);
    }
    
    async extractSourceData(sourceSheet, templateHeaders) {
        const data = [];
        const sourceHeaders = this.getSourceHeaders(sourceSheet);
        
        // Find header row
        let headerRowIndex = 1;
        for (let i = 1; i <= 10; i++) {
            const row = sourceSheet.getRow(i);
            if (this.hasHeaders(row)) {
                headerRowIndex = i;
                break;
            }
        }
        
        // Extract data rows
        for (let row = headerRowIndex + 1; row <= sourceSheet.rowCount; row++) {
            const rowData = {};
            let hasData = false;
            
            for (let col = 0; col < sourceHeaders.length; col++) {
                const cell = sourceSheet.getRow(row).getCell(col + 1);
                const value = cell.value;
                
                if (value !== null && value !== undefined && value !== '') {
                    hasData = true;
                }
                
                rowData[sourceHeaders[col]] = value;
            }
            
            if (hasData) {
                data.push(rowData);
            } else {
                break;
            }
        }
        
        return data;
    }
    
    getSourceHeaders(worksheet) {
        const headers = [];
        const headerRow = worksheet.getRow(1);
        
        headerRow.eachCell(cell => {
            if (cell.value && cell.value.toString().trim()) {
                headers.push(cell.value.toString().trim());
            }
        });
        
        return headers;
    }
    
    hasHeaders(row) {
        let headerCount = 0;
        row.eachCell(cell => {
            if (cell.value && cell.value.toString().trim()) {
                headerCount++;
            }
        });
        return headerCount >= 2;
    }
    
    applyMappingsToData(sourceData, mappings) {
        const mappedData = [];
        
        for (const row of sourceData) {
            const mappedRow = {};
            
            for (const [sourceField, targetField] of Object.entries(mappings)) {
                if (row[sourceField] !== undefined) {
                    mappedRow[targetField] = row[sourceField];
                }
            }
            
            mappedData.push(mappedRow);
        }
        
        return mappedData;
    }
    
    clearDataRows(targetSheet, sheetConfig) {
        // Start from row 2 (after header)
        for (let row = targetSheet.rowCount; row >= 2; row--) {
            const worksheetRow = targetSheet.getRow(row);
            let hasFormula = false;
            
            // Check if row contains formulas
            worksheetRow.eachCell(cell => {
                if (cell.formula) hasFormula = true;
            });
            
            if (!hasFormula) {
                worksheetRow.eachCell(cell => {
                    cell.value = null;
                });
            }
        }
    }
    
    async writeDataToSheet(targetSheet, mappedData, sheetConfig) {
        let currentRow = 2; // Start after header
        
        for (const rowData of mappedData) {
            const targetRow = targetSheet.getRow(currentRow);
            
            for (const [targetField, value] of Object.entries(rowData)) {
                // Find column for this field
                const columnIndex = sheetConfig.headers.findIndex(h => h.header === targetField);
                if (columnIndex !== -1) {
                    const cell = targetRow.getCell(columnIndex + 1);
                    cell.value = value;
                }
            }
            
            currentRow++;
        }
    }
    
    async preserveFormulas(targetSheet, sheetConfig) {
        for (const formula of sheetConfig.formulas || []) {
            const cell = targetSheet.getCell(formula.cell);
            if (!cell.value || cell.value === null) {
                cell.value = { formula: formula.formula };
            }
        }
    }
    
    async preserveFormatting(targetSheet, sheetConfig) {
        for (const [cellRef, formatting] of Object.entries(sheetConfig.formatting || {})) {
            const cell = targetSheet.getCell(cellRef);
            
            if (formatting.font) cell.font = formatting.font;
            if (formatting.fill) cell.fill = formatting.fill;
            if (formatting.border) cell.border = formatting.border;
            if (formatting.alignment) cell.alignment = formatting.alignment;
            if (formatting.numFmt) cell.numFmt = formatting.numFmt;
        }
        
        // Preserve column widths
        targetSheet.columns.forEach((column, idx) => {
            if (sheetConfig.headers[idx] && sheetConfig.headers[idx].width) {
                column.width = sheetConfig.headers[idx].width;
            }
        });
    }
    
    async preserveMergedCells(targetSheet, sheetConfig) {
        for (const merge of sheetConfig.mergedCells || []) {
            targetSheet.mergeCells(merge.range);
        }
    }
}

module.exports = new LegacyTransformationService();

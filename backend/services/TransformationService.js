const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

class TransformationService {
    constructor() {
        this.generatedDir = path.join(__dirname, '../uploads/generated');
        this.templatesDir = path.join(__dirname, '../uploads/templates');
        // Ensure directories exist
        if (!fs.existsSync(this.generatedDir)) {
            fs.mkdirSync(this.generatedDir, { recursive: true });
        }
        if (!fs.existsSync(this.templatesDir)) {
            fs.mkdirSync(this.templatesDir, { recursive: true });
        }
    }
    
    async transformData(sourceFilePath, templateId, mappings, options = {}) {
        // Validation
        if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
            throw new Error('Source file does not exist');
        }
        const templateJsonPath = path.join(__dirname, `../data/templates/${templateId}.json`);
        if (!fs.existsSync(templateJsonPath)) {
            throw new Error('Template definition file does not exist');
        }
        const templateWorkbookPath = path.join(this.templatesDir, `${templateId}.xlsx`);
        if (!fs.existsSync(templateWorkbookPath)) {
            throw new Error('Template workbook does not exist');
        }
        if (!mappings || Object.keys(mappings).length === 0) {
            throw new Error('No mappings provided');
        }

        // Load workbooks and template structure
        const templateStructure = JSON.parse(fs.readFileSync(templateJsonPath, 'utf8'));
        const sourceWorkbook = new ExcelJS.Workbook();
        await sourceWorkbook.xlsx.readFile(sourceFilePath);
        const templateWorkbook = new ExcelJS.Workbook();
        await templateWorkbook.xlsx.readFile(templateWorkbookPath);

        // Build unified generation context
        const GenerationContext = require('./generators/GenerationContext');
        const context = new GenerationContext({
            template: templateStructure,
            templateStructure,
            sourceWorkbook,
            templateWorkbook,
            mappings,
            options
        });

        // Select appropriate generator via factory
        const generatorFactory = require('./GeneratorFactory');
        const format = options.outputFormat ? options.outputFormat.toLowerCase() : 'xlsx';
        const generator = generatorFactory.getGenerator(format);
        // Delegate generation
        const result = await generator.generate(context);
        return result;
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

module.exports = new TransformationService();
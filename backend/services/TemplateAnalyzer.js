const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

class TemplateAnalyzer {
    async analyzeTemplate(filePath, templateId, templateName) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const templateStructure = {
            templateId: templateId,
            templateName: templateName,
            sheetCount: workbook.worksheets.length,
            sheets: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        for (const [index, worksheet] of workbook.worksheets.entries()) {
            const sheetStructure = await this.analyzeSheet(worksheet, index);
            templateStructure.sheets.push(sheetStructure);
        }
        
        // Save template structure to file
        const templateDir = path.join(__dirname, '../data/templates');
        if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });
        
        const templateFile = path.join(templateDir, `${templateId}.json`);
        fs.writeFileSync(templateFile, JSON.stringify(templateStructure, null, 2));
        
        return templateStructure;
    }
    
    async analyzeSheet(worksheet, index) {
        const sheetData = {
            sheetName: worksheet.name,
            sheetOrder: index,
            rowCount: worksheet.rowCount,
            columnCount: worksheet.columnCount,
            headers: [],
            mergedCells: [],
            formulas: [],
            formatting: {}
        };
        
        // Extract headers from first row
        const headerRow = worksheet.getRow(1);
        for (let col = 1; col <= worksheet.columnCount; col++) {
            const cell = headerRow.getCell(col);
            const headerValue = cell.value ? cell.value.toString().trim() : null;
            
            if (headerValue && headerValue !== '') {
                sheetData.headers.push({
                    header: headerValue,
                    columnLetter: this.getColumnLetter(col),
                    columnIndex: col,
                    dataType: this.detectDataType(worksheet, col),
                    required: this.isRequiredColumn(worksheet, col)
                });
            }
        }
        
        // Extract merged cells
        if (worksheet.mergedCells) {
            worksheet.mergedCells.forEach(merge => {
                sheetData.mergedCells.push({
                    range: `${this.getColumnLetter(merge.top)}${merge.top}:${this.getColumnLetter(merge.bottom)}${merge.bottom}`
                });
            });
        }
        
        // Extract formulas and formatting
        for (let row = 1; row <= Math.min(worksheet.rowCount, 100); row++) {
            for (let col = 1; col <= worksheet.columnCount; col++) {
                const cell = worksheet.getRow(row).getCell(col);
                
                if (cell.formula) {
                    sheetData.formulas.push({
                        cell: `${this.getColumnLetter(col)}${row}`,
                        formula: cell.formula
                    });
                }
                
                const cellKey = `${this.getColumnLetter(col)}${row}`;
                sheetData.formatting[cellKey] = {
                    font: cell.font ? JSON.parse(JSON.stringify(cell.font)) : null,
                    fill: cell.fill ? JSON.parse(JSON.stringify(cell.fill)) : null,
                    border: cell.border ? JSON.parse(JSON.stringify(cell.border)) : null,
                    alignment: cell.alignment ? JSON.parse(JSON.stringify(cell.alignment)) : null,
                    numFmt: cell.numFmt || null
                };
            }
        }
        
        return sheetData;
    }
    
    detectDataType(worksheet, col) {
        let typeCounts = { string: 0, number: 0, date: 0, boolean: 0 };
        
        for (let row = 2; row <= Math.min(worksheet.rowCount, 11); row++) {
            const cell = worksheet.getRow(row).getCell(col);
            if (cell.value !== null && cell.value !== undefined) {
                if (typeof cell.value === 'number') typeCounts.number++;
                else if (cell.value instanceof Date) typeCounts.date++;
                else if (typeof cell.value === 'boolean') typeCounts.boolean++;
                else typeCounts.string++;
            }
        }
        
        const maxType = Object.entries(typeCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        return maxType;
    }
    
    isRequiredColumn(worksheet, col) {
        let nonEmptyCount = 0;
        for (let row = 2; row <= Math.min(worksheet.rowCount, 11); row++) {
            const cell = worksheet.getRow(row).getCell(col);
            if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                nonEmptyCount++;
            }
        }
        return nonEmptyCount > 5;
    }
    
    getColumnLetter(colNumber) {
        let result = '';
        while (colNumber > 0) {
            colNumber--;
            result = String.fromCharCode(65 + (colNumber % 26)) + result;
            colNumber = Math.floor(colNumber / 26);
        }
        return result;
    }
}

module.exports = new TemplateAnalyzer();
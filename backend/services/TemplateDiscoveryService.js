const ExcelJS = require('exceljs');

class TemplateDiscoveryService {
    async discoverTemplate(filePath) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const discovery = {
            workbookName: workbook.model?.workbook?.properties?.title || 'Untitled',
            sheets: [],
            totalSheets: workbook.worksheets.length
        };
        
        for (const [index, worksheet] of workbook.worksheets.entries()) {
            const sheetData = await this.analyzeSheet(worksheet, index);
            discovery.sheets.push(sheetData);
        }
        
        return discovery;
    }
    
    async analyzeSheet(worksheet, index) {
        const headers = [];
        const columnMap = {};
        const columnWidths = [];
        const mergedCells = [];
        const formats = {};
        
        // Get header row (first non-empty row)
        let headerRowIndex = 1;
        let headerRow = worksheet.getRow(headerRowIndex);
        
        // Find actual header row
        while (headerRowIndex <= 10 && !this.hasData(headerRow)) {
            headerRowIndex++;
            headerRow = worksheet.getRow(headerRowIndex);
        }
        
        // Extract headers
        let startCol = 1;
        let endCol = worksheet.columnCount;
        
        for (let col = startCol; col <= endCol; col++) {
            const cell = headerRow.getCell(col);
            let headerValue = cell.value ? cell.value.toString().trim() : null;
            
            if (headerValue && !this.isNullOrEmpty(headerValue)) {
                const colLetter = this.getColumnLetter(col);
                headers.push(headerValue);
                columnMap[colLetter] = headerValue;
                
                // Capture column width
                const column = worksheet.getColumn(col);
                columnWidths.push({
                    col: colLetter,
                    width: column.width || 10
                });
                
                // Capture cell formatting
                formats[colLetter] = {
                    font: cell.font,
                    fill: cell.fill,
                    border: cell.border,
                    alignment: cell.alignment,
                    numFmt: cell.numFmt
                };
            }
        }
        
        // Capture merged cells
        if (worksheet.mergedCells) {
            worksheet.mergedCells.forEach(merge => {
                mergedCells.push({
                    range: merge,
                    top: merge.top,
                    left: merge.left,
                    bottom: merge.bottom,
                    right: merge.right
                });
            });
        }
        
        // Find data start row (first row after headers with data)
        let dataStartRow = headerRowIndex + 1;
        let foundData = false;
        
        for (let row = dataStartRow; row <= Math.min(dataStartRow + 10, worksheet.rowCount); row++) {
            const dataRow = worksheet.getRow(row);
            if (this.hasData(dataRow)) {
                dataStartRow = row;
                foundData = true;
                break;
            }
        }
        
        return {
            sheetName: worksheet.name,
            sheetIndex: index,
            headers: headers,
            columnMap: columnMap,
            headerRowIndex: headerRowIndex,
            dataStartRow: foundData ? dataStartRow : headerRowIndex + 1,
            columnCount: headers.length,
            columnWidths: columnWidths,
            mergedCells: mergedCells,
            formats: formats
        };
    }
    
    hasData(row) {
        let hasValue = false;
        row.eachCell(cell => {
            if (cell.value && cell.value.toString().trim()) {
                hasValue = true;
            }
        });
        return hasValue;
    }
    
    isNullOrEmpty(value) {
        return !value || value.toString().trim() === '';
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

module.exports = new TemplateDiscoveryService();
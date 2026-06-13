const ExcelJS = require('exceljs');

class SourceAnalyzerService {
    async analyzeSource(filePath) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const analysis = {
            fileName: filePath.split('/').pop(),
            sheets: [],
            totalSheets: workbook.worksheets.length,
            summary: {}
        };
        
        for (const worksheet of workbook.worksheets) {
            const sheetAnalysis = await this.analyzeSheet(worksheet);
            analysis.sheets.push(sheetAnalysis);
        }
        
        // Generate summary
        analysis.summary = this.generateSummary(analysis.sheets);
        
        return analysis;
    }
    
    async analyzeSheet(worksheet) {
        const headers = [];
        const dataTypes = {};
        const dataPreview = [];
        let emptyColumns = [];
        let duplicateColumns = [];
        
        // Find header row
        let headerRowIndex = 1;
        let headerRow = worksheet.getRow(headerRowIndex);
        
        for (let i = 1; i <= 10; i++) {
            const row = worksheet.getRow(i);
            if (this.hasHeaders(row)) {
                headerRowIndex = i;
                headerRow = row;
                break;
            }
        }
        
        // Extract headers
        const headerPositions = {};
        for (let col = 1; col <= worksheet.columnCount; col++) {
            const cell = headerRow.getCell(col);
            let headerValue = cell.value ? cell.value.toString().trim() : null;
            
            if (headerValue && !this.isEmpty(headerValue)) {
                headers.push(headerValue);
                headerPositions[headerValue] = col;
                
                // Check for duplicates
                if (headers.filter(h => h === headerValue).length > 1) {
                    duplicateColumns.push(headerValue);
                }
            } else {
                emptyColumns.push(this.getColumnLetter(col));
            }
        }
        
        // Detect data types for each column
        const dataStartRow = headerRowIndex + 1;
        const sampleRows = Math.min(10, worksheet.rowCount - dataStartRow);
        
        for (const header of headers) {
            const col = headerPositions[header];
            const typeCounts = { string: 0, number: 0, date: 0, boolean: 0, empty: 0 };
            
            for (let row = dataStartRow; row <= dataStartRow + sampleRows; row++) {
                const cell = worksheet.getRow(row).getCell(col);
                const type = this.getCellType(cell);
                typeCounts[type]++;
            }
            
            const dominantType = Object.entries(typeCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
            dataTypes[header] = dominantType;
        }
        
        // Get data preview
        for (let row = dataStartRow; row <= Math.min(dataStartRow + 5, worksheet.rowCount); row++) {
            const rowData = {};
            for (const header of headers) {
                const col = headerPositions[header];
                const cell = worksheet.getRow(row).getCell(col);
                rowData[header] = cell.value;
            }
            dataPreview.push(rowData);
        }
        
        return {
            sheetName: worksheet.name,
            headers: headers,
            headerRowIndex: headerRowIndex,
            dataStartRow: dataStartRow,
            totalRows: worksheet.rowCount,
            dataTypes: dataTypes,
            dataPreview: dataPreview,
            emptyColumns: emptyColumns,
            duplicateColumns: duplicateColumns
        };
    }
    
    hasHeaders(row) {
        let headerCount = 0;
        row.eachCell(cell => {
            if (cell.value && cell.value.toString().trim()) {
                headerCount++;
            }
        });
        return headerCount >= 3;
    }
    
    getCellType(cell) {
        if (!cell.value) return 'empty';
        if (typeof cell.value === 'number') return 'number';
        if (cell.value instanceof Date) return 'date';
        if (typeof cell.value === 'boolean') return 'boolean';
        return 'string';
    }
    
    isEmpty(value) {
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
    
    generateSummary(sheets) {
        let totalHeaders = 0;
        let totalRows = 0;
        
        for (const sheet of sheets) {
            totalHeaders += sheet.headers.length;
            totalRows += sheet.totalRows;
        }
        
        return {
            totalSheets: sheets.length,
            totalHeaders: totalHeaders,
            totalRows: totalRows,
            averageHeadersPerSheet: totalHeaders / sheets.length,
            averageRowsPerSheet: totalRows / sheets.length
        };
    }
}

module.exports = new SourceAnalyzerService();
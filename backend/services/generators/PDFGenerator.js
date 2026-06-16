// services/generators/PDFGenerator.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const AppError = require('../AppError');

/**
 * PDFGenerator - creates a simple PDF report based on the GenerationContext.
 * It includes a title (template name) and a table‑like representation of the source data.
 */
class PDFGenerator {
  /**
   * Generate PDF output.
   * @param {object} context - GenerationContext instance
   * @returns {object} result containing outputPath, outputFilename, format
   */
  async generate(context) {
    const { template, sourceWorkbook, mappings, options } = context;
    if (!sourceWorkbook) {
      throw new AppError('Source workbook not loaded', 'GENERATOR_ERROR');
    }

    // Extract source data similarly to ExcelGenerator
    const sourceData = await this._extractSourceData(sourceWorkbook);
    const mappedData = this._applyMappings(sourceData, mappings);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const generatedDir = path.join(__dirname, '../../uploads/generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    const timestamp = Date.now();
    const outputFilename = `output_${timestamp}.pdf`;
    const outputPath = path.join(generatedDir, outputFilename);
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc.fontSize(20).text(template.name || 'Report', { align: 'center' });
    doc.moveDown();

    // Simple table header
    if (mappedData.length > 0) {
      const headers = Object.keys(mappedData[0]);
      doc.fontSize(12).text(headers.join(' | '), { underline: true });
      doc.moveDown(0.5);
      // Rows
      for (const row of mappedData) {
        const line = headers.map(h => String(row[h] ?? '')).join(' | ');
        doc.text(line);
      }
    } else {
      doc.text('No data available');
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          return reject(new AppError('Failed to generate PDF output', 'GENERATOR_ERROR'));
        }
        resolve({ outputPath, outputFilename, format: 'pdf' });
      });
      stream.on('error', err => reject(new AppError(err.message, 'GENERATOR_ERROR')));
    });
  }

  async _extractSourceData(workbook) {
    const sheet = workbook.getWorksheet(1);
    if (!sheet) return [];
    const data = [];
    const headers = this._getHeaders(sheet);
    // Find header row (simple heuristic)
    let headerRowIdx = 1;
    for (let i = 1; i <= 10; i++) {
      const row = sheet.getRow(i);
      if (this._hasHeaders(row)) { headerRowIdx = i; break; }
    }
    for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const rowData = {};
      let hasData = false;
      for (let c = 0; c < headers.length; c++) {
        const cell = row.getCell(c + 1);
        const val = cell.value;
        if (val !== null && val !== undefined && val !== '') hasData = true;
        rowData[headers[c]] = val;
      }
      if (hasData) data.push(rowData); else break;
    }
    return data;
  }

  _getHeaders(sheet) {
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell(cell => {
      if (cell.value && cell.value.toString().trim()) {
        headers.push(cell.value.toString().trim());
      }
    });
    return headers;
  }

  _hasHeaders(row) {
    let count = 0;
    row.eachCell(cell => {
      if (cell.value && cell.value.toString().trim()) count++;
    });
    return count >= 2;
  }

  _applyMappings(sourceData, mappings) {
    if (!mappings) return sourceData;
    const mapped = [];
    for (const row of sourceData) {
      const newRow = {};
      for (const [src, tgt] of Object.entries(mappings)) {
        if (row[src] !== undefined) newRow[tgt] = row[src];
      }
      mapped.push(newRow);
    }
    return mapped;
  }
}

module.exports = PDFGenerator;

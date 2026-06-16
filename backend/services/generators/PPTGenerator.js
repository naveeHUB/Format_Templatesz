// services/generators/PPTGenerator.js
const path = require('path');
const fs = require('fs');
const PPTX = require('pptxgenjs');
const AppError = require('../AppError');

/**
 * PPTGenerator - creates a simple PowerPoint presentation based on the GenerationContext.
 * Includes a title slide (template name) and a data slide with bullet points for each record.
 */
class PPTGenerator {
  /**
   * Generate PPTX output.
   * @param {object} context - GenerationContext instance
   * @returns {object} result containing outputPath, outputFilename, format
   */
  async generate(context) {
    const { template, sourceWorkbook, mappings, options } = context;
    if (!sourceWorkbook) {
      throw new AppError('Source workbook not loaded', 'GENERATOR_ERROR');
    }

    // Extract source data
    const sourceData = await this._extractSourceData(sourceWorkbook);
    const mappedData = this._applyMappings(sourceData, mappings);

    const pptx = new PPTX();

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(template.name || 'Report', { x: 1, y: 1.5, fontSize: 36, bold: true, align: 'center' });

    // Data slide (single slide with bullet points)
    if (mappedData.length > 0) {
      const dataSlide = pptx.addSlide();
      const headers = Object.keys(mappedData[0]);
      const lines = mappedData.map(row => {
        return headers.map(h => `${h}: ${row[h] ?? ''}`).join('\n');
      });
      dataSlide.addText(lines.join('\n\n'), { x: 0.5, y: 0.5, fontSize: 12, bullet: true, marginPt: 10 });
    } else {
      const emptySlide = pptx.addSlide();
      emptySlide.addText('No data available', { x: 1, y: 2, fontSize: 24, align: 'center' });
    }

    const generatedDir = path.join(__dirname, '../../uploads/generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    const format = (options && options.outputFormat) ? options.outputFormat.toLowerCase() : 'pptx';
    const ext = format === 'ppt' ? 'ppt' : 'pptx';
    const timestamp = Date.now();
    const outputFilename = `output_${timestamp}.${ext}`;
    const outputPath = path.join(generatedDir, outputFilename);
    try {
      await pptx.writeFile({ fileName: outputPath });
    } catch (err) {
      throw new AppError(err.message, 'GENERATOR_ERROR');
    }
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new AppError('Failed to generate PPT output', 'GENERATOR_ERROR');
    }
    return { outputPath, outputFilename, format: ext };
  }

  async _extractSourceData(workbook) {
    const sheet = workbook.getWorksheet(1);
    if (!sheet) return [];
    const data = [];
    const headers = this._getHeaders(sheet);
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

module.exports = PPTGenerator;

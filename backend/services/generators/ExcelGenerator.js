// services/generators/ExcelGenerator.js
const path = require('path');
const fs = require('fs');
const AppError = require('../AppError');
const FormulaResolver = require('../FormulaResolver');

/**
 * ExcelGenerator - generates Excel files using the existing transformation logic.
 * It expects a GenerationContext containing the template metadata, parsed template structure,
 * sourceWorkbook, templateWorkbook, mappings and options.
 */
class ExcelGenerator {
  /**
   * Generate Excel output.
   * @param {Object} context - GenerationContext instance
   * @returns {Object} result containing outputPath, outputFilename, format
   */
  async generate(context) {
    const { template, templateStructure, sourceWorkbook, templateWorkbook, mappings, options } = context;
    // Ensure required data present
    if (!sourceWorkbook || !templateWorkbook) {
      throw new AppError('Workbooks not loaded', 'GENERATOR_ERROR');
    }
    // Process each sheet according to template configuration
    for (const sheetConfig of templateStructure.sheets) {
      const sourceSheet = sourceWorkbook.getWorksheet(1); // assume first sheet
      const targetSheet = templateWorkbook.getWorksheet(sheetConfig.sheetName);
      if (sourceSheet && targetSheet) {
        await this.transformSheet(sourceSheet, targetSheet, sheetConfig, mappings, options);
      }
    }

    // Write output to generated directory
    const generatedDir = path.join(__dirname, '../../uploads/generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    const format = (options && options.outputFormat) ? options.outputFormat.toLowerCase() : 'xlsx';
    const ext = format === 'xls' ? 'xls' : 'xlsx';
    const timestamp = Date.now();
    const outputFilename = `output_${timestamp}.${ext}`;
    const outputPath = path.join(generatedDir, outputFilename);
    await templateWorkbook.xlsx.writeFile(outputPath);
    // Validate file creation
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new AppError('Failed to generate Excel output', 'GENERATOR_ERROR');
    }
    return { outputPath, outputFilename, format: ext };
  }

  async transformSheet(sourceSheet, targetSheet, sheetConfig, mappings, options) {
    const sourceData = await this.extractSourceData(sourceSheet, sheetConfig.headers);
    const mappedData = this.applyMappingsToData(sourceData, mappings);
    this.clearDataRows(targetSheet, sheetConfig);
    await this.writeDataToSheet(targetSheet, mappedData, sheetConfig);
    // Compute and write formula-driven columns AFTER regular data is written
    await this.writeFormulaColumns(targetSheet, sourceData, sheetConfig, mappings, options);
    await this.preserveFormulas(targetSheet, sheetConfig);
    await this.preserveFormatting(targetSheet, sheetConfig);
    await this.preserveMergedCells(targetSheet, sheetConfig);
  }

  /**
   * Compute values for every formula column in this sheet and write them.
   * Writes a live Excel formula with the pre-calculated result stored in the
   * cell so the file is correct both with and without Excel recalculation.
   */
  async writeFormulaColumns(targetSheet, sourceData, sheetConfig, mappings, options) {
    const formulaColumns = sheetConfig.formulaColumns || [];
    if (formulaColumns.length === 0) return;

    const formulaResolutions = (options && options.formulaResolutions) ? options.formulaResolutions : {};

    for (const formulaCol of formulaColumns) {
      if (!formulaCol.isSimpleArithmetic) {
        // Complex formula — skip computation, leave existing template formula intact
        continue;
      }

      for (let rowIdx = 0; rowIdx < sourceData.length; rowIdx++) {
        const targetRowNum = rowIdx + 2; // row 1 = header, row 2 = first data row
        const targetRow = targetSheet.getRow(targetRowNum);
        const cell = targetRow.getCell(formulaCol.columnIndex);

        // Pre-calculate the numeric result
        const computedValue = FormulaResolver.computeValue(
          formulaCol,
          sourceData[rowIdx],
          mappings,
          formulaResolutions
        );

        // Write BOTH a live Excel formula AND the pre-calculated result
        cell.value = {
          formula: FormulaResolver.buildExcelFormula(formulaCol.formulaTemplate, targetRowNum),
          result: computedValue
        };
      }
    }
  }

  async extractSourceData(sourceSheet, templateHeaders) {
    const data = [];
    const sourceHeaders = this.getSourceHeaders(sourceSheet);
    // Find header row (simple heuristic: first row with at least 2 values)
    let headerRowIndex = 1;
    for (let i = 1; i <= 10; i++) {
      const row = sourceSheet.getRow(i);
      if (this.hasHeaders(row)) {
        headerRowIndex = i;
        break;
      }
    }
    // Extract rows after header
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
    for (let row = targetSheet.rowCount; row >= 2; row--) {
      const worksheetRow = targetSheet.getRow(row);
      let hasFormula = false;
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
    let currentRow = 2;
    for (const rowData of mappedData) {
      const targetRow = targetSheet.getRow(currentRow);
      for (const [targetField, value] of Object.entries(rowData)) {
        const columnIndex = sheetConfig.headers.findIndex(h => 
          h.header.toLowerCase().trim() === targetField.toLowerCase().trim()
        );
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
      if (!cell.value) {
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
    // Preserve column widths if defined in headers
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

module.exports = ExcelGenerator;

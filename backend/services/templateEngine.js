const path = require('path');
const fs = require('fs');
const { getTemplate } = require('../config/templates.registry');
const { readWorkbook, getSheetData } = require('./excelReader');
const { mapInputData } = require('./mappingEngine');
const { validateData } = require('./validationEngine');
const { generateExcel } = require('./excelWriter');

/**
 * Main coordinator that reads the input data, loads the template, maps columns,
 * validates values, shifts formulas, generates the formatted sheet, and writes summaries.
 * 
 * @param {object} params
 * @param {string} params.templateId - ID of template in registry
 * @param {string} params.inputFilePath - Full path to uploaded Excel data file
 * @param {string} params.outputFilePath - Full path where output Excel should be saved
 * @param {string} params.customSheetName - Optional custom name for generated sheet
 * @returns {object} Processing metrics, validation report, and summary rows
 */
async function processWorkbook({
  templateId,
  inputFilePath,
  outputFilePath,
  customSheetName
}) {
  // 1. Load template configuration
  const templateConfig = getTemplate(templateId);
  if (!templateConfig) {
    throw new Error(`Template "${templateId}" is not registered in the system.`);
  }

  // Determine absolute path of the template file
  // Determine absolute path of the template file
  let absoluteTemplatePath = templateConfig.filePath;
  
  // If path is not absolute, resolve from project root
  if (!path.isAbsolute(absoluteTemplatePath)) {
    // Try multiple possible locations
    const possiblePaths = [
      path.resolve(process.cwd(), absoluteTemplatePath), // From project root
      path.resolve(__dirname, '..', '..', absoluteTemplatePath), // From backend directory
      path.resolve(__dirname, '..', absoluteTemplatePath), // From services directory
      path.join(process.cwd(), 'backend', 'uploads', 'templates', 'sales_v1.xlsx') // Fallback
    ];
    
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        absoluteTemplatePath = tryPath;
        break;
      }
    }
    
    // If still not found, try the original resolution method
    if (!fs.existsSync(absoluteTemplatePath)) {
      absoluteTemplatePath = path.resolve(path.join(__dirname, '..', '..'), absoluteTemplatePath.replace(/^\//, ''));
    }
  }

  if (!fs.existsSync(absoluteTemplatePath)) {
    // Final fallback - check if template exists in templates folder
    const fallbackPath = path.join(process.cwd(), 'backend', 'uploads', 'templates', 'sales_v1.xlsx');
    if (fs.existsSync(fallbackPath)) {
      absoluteTemplatePath = fallbackPath;
      console.log(`[TemplateEngine] Using fallback template path: ${absoluteTemplatePath}`);
    } else {
      throw new Error(`Template Excel file not found on disk. Tried: ${templateConfig.filePath} and ${fallbackPath}`);
    }
  }

  console.log(`[TemplateEngine] Using template file: ${absoluteTemplatePath}`);

  // 2. Read template headers
  const templateWorkbook = readWorkbook(absoluteTemplatePath);
  const templateSheetInfo = getSheetData(
    templateWorkbook,
    templateConfig.sheetName,
    templateConfig.headerRow,
    templateConfig.dataStartRow
  );

  const templateHeaders = templateSheetInfo.headers;
  if (templateHeaders.length === 0) {
    throw new Error(`Template sheet "${templateConfig.sheetName || 'default'}" header row is empty.`);
  }

  // 3. Read uploaded source data sheet
  if (!fs.existsSync(inputFilePath)) {
    throw new Error(`Uploaded input data file not found at: ${inputFilePath}`);
  }
  const inputWorkbook = readWorkbook(inputFilePath);
  // Default to reading the first sheet of input workbook (headerRow=1, dataStartRow=2)
  const inputSheetInfo = getSheetData(inputWorkbook, null, 1, 2);

  console.log(`[TemplateEngine] Loaded ${inputSheetInfo.rows.length} rows from uploaded file`);

  // 4. Map columns dynamically
  const mappedRows = mapInputData(
    inputSheetInfo.rows,
    inputSheetInfo.headers,
    templateConfig.mapping,
    templateHeaders
  );

  // 5. Run validation checks
  const validationReport = validateData(mappedRows);

  // 6. Generate final formatted Excel sheet
  const writeResult = await generateExcel({
    templateConfig,
    mappedRows,
    templateWorkbook,
    templateHeaders,
    outputFilePath,
    customSheetName
  });

  return {
    validation: validationReport,
    summaryRows: writeResult.summaryRows,
    templateName: templateConfig.name,
    sheetName: customSheetName || templateConfig.sheetName || 'Sales Plan'
  };
}

module.exports = {
  processWorkbook
};
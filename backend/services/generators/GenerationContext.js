// services/generators/GenerationContext.js
/**
 * Unified context passed to all generators.
 * @typedef {Object} GenerationContext
 * @property {Object} template - Template metadata (from registry)
 * @property {Object} templateStructure - Parsed template JSON structure
 * @property {ExcelJS.Workbook} sourceWorkbook - Loaded source workbook
 * @property {ExcelJS.Workbook} templateWorkbook - Loaded template workbook (for Excel)
 * @property {Object} mappings - Field mapping definitions
 * @property {Object} options - Additional options (e.g., outputFormat)
 */

module.exports = class GenerationContext {
  constructor({ template, templateStructure, sourceWorkbook, templateWorkbook, mappings, options }) {
    this.template = template;
    this.templateStructure = templateStructure;
    this.sourceWorkbook = sourceWorkbook;
    this.templateWorkbook = templateWorkbook;
    this.mappings = mappings;
    this.options = options || {};
    // User-confirmed formula variable bindings:
    // { headerName: { type: 'column'|'constant', value: string } }
    this.formulaResolutions = (options && options.formulaResolutions) || {};
  }
};

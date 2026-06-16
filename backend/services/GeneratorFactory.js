// services/GeneratorFactory.js
const path = require('path');
// Import generator classes (they will be created)
const ExcelGenerator = require('./generators/ExcelGenerator');
const PDFGenerator = require('./generators/PDFGenerator');
const PPTGenerator = require('./generators/PPTGenerator');

class GeneratorFactory {
  constructor() {
    this.generators = new Map();
    // Register default generators and format aliases
    const excelGenerator = new ExcelGenerator();
    this.register('excel', excelGenerator);
    this.register('xlsx', excelGenerator);
    this.register('xls', excelGenerator);

    this.register('pdf', new PDFGenerator());

    const pptGenerator = new PPTGenerator();
    this.register('pptx', pptGenerator);
    this.register('ppt', pptGenerator);
  }

  /**
   * Register a generator instance for a given type.
   * @param {string} type - e.g., 'excel', 'pdf', 'pptx'
   * @param {object} generatorInstance - instance with a generate(context) method
   */
  register(type, generatorInstance) {
    this.generators.set(type.toLowerCase(), generatorInstance);
  }

  /**
   * Retrieve a generator. Falls back to ExcelGenerator if not found.
   * @param {string} type
   */
  getGenerator(type) {
    const key = (type || 'excel').toLowerCase();
    return this.generators.get(key) || this.generators.get('excel');
  }
}

// Export a singleton for reuse across the app
module.exports = new GeneratorFactory();

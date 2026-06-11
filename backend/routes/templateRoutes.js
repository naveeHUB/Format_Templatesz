const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  loadRegistry,
  getTemplate,
  registerTemplate,
  removeTemplate
} = require('../config/templates.registry');

const router = express.Router();

// Configure multer storage for templates
const templatesFolder = path.join(__dirname, '..', 'uploads', 'templates');

if (!fs.existsSync(templatesFolder)) {
  fs.mkdirSync(templatesFolder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, templatesFolder),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-()_ ]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Invalid file type. Only Excel sheets are allowed.'));
    }
    cb(null, true);
  },
  limits: { fileSize: 30 * 1024 * 1024 }
});

// GET: List all templates
router.get('/', (req, res) => {
  try {
    const registry = loadRegistry();
    return res.json(registry);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET: Single template details
router.get('/:templateId', (req, res) => {
  try {
    const { templateId } = req.params;
    const template = getTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: `Template "${templateId}" not found.` });
    }
    return res.json(template);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST: Register/Upload template
router.post('/', upload.single('templateFile'), (req, res) => {
  try {
    const configData = req.body.config ? JSON.parse(req.body.config) : null;
    if (!configData) {
      return res.status(400).json({ error: 'Missing template configuration JSON.' });
    }

    const {
      templateId,
      name,
      sheetName,
      headerRow,
      dataStartRow,
      mapping,
      summary
    } = configData;

    if (!templateId || !name) {
      return res.status(400).json({ error: 'templateId and name are required.' });
    }

    // Determine template filePath
    let filePath = configData.filePath;
    if (req.file) {
      // If a template file was uploaded, save it in uploads/templates/ and store path relative to backend directory or absolute
      filePath = `/backend/uploads/templates/${req.file.filename}`;
    }

    if (!filePath) {
      return res.status(400).json({ error: 'Please upload a template Excel file or specify a valid filePath.' });
    }

    const templateConfig = {
      templateId,
      name,
      filePath,
      sheetName: sheetName || 'Sheet1',
      headerRow: parseInt(headerRow) || 1,
      dataStartRow: parseInt(dataStartRow) || 2,
      mapping: mapping || {},
      summary: summary || { enabled: false }
    };

    registerTemplate(templateConfig);
    return res.status(201).json({
      message: `Template "${name}" registered successfully.`,
      template: templateConfig
    });
  } catch (error) {
    console.error('Error registering template:', error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE: Remove template
router.delete('/:templateId', (req, res) => {
  try {
    const { templateId } = req.params;
    const template = getTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: `Template "${templateId}" not found.` });
    }

    // Optionally delete files associated with template
    if (template.filePath && template.filePath.includes('/uploads/templates/')) {
      const absPath = path.resolve(path.join(__dirname, '..', '..'), template.filePath.replace(/^\//, ''));
      if (fs.existsSync(absPath)) {
        try {
          fs.unlinkSync(absPath);
        } catch (err) {
          console.warn('Failed to delete template file:', err.message);
        }
      }
    }

    removeTemplate(templateId);
    return res.json({ message: `Template "${templateId}" deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

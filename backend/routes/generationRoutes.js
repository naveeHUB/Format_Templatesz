// backend/routes/generationRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const TemplateDiscoveryService = require('../services/TemplateDiscoveryService');
const SourceAnalyzerService = require('../services/SourceAnalyzerService');
const MatchingEngineService = require('../services/MatchingEngineService');
const TransformationService = require('../services/TransformationService');
const Database = require('../database/database');

// Multer for handling file uploads in generation step
const upload = multer({ dest: path.join(__dirname, '../../uploads/tmp') });

// Phase 1: Discover template structure
router.post('/templates/discover', upload.single('file'), async (req, res) => {
  try {
    const discovery = await TemplateDiscoveryService.discoverTemplate(req.file.path);
    res.json(discovery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Phase 2: Analyze source file
router.post('/source/analyze', upload.single('file'), async (req, res) => {
  try {
    const analysis = await SourceAnalyzerService.analyzeSource(req.file.path);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Phase 3: Auto match template
router.post('/match', async (req, res) => {
  try {
    const { sourceHeaders, templateId } = req.body;
    const matches = await MatchingEngineService.findBestMatch(sourceHeaders, templateId);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Phase 4-5: Transform data (supports Excel, PDF, PPT)
// Expects multipart form: file (source workbook), templateId, mappings (JSON string), format (optional)
router.post('/generate', upload.single('file'), async (req, res) => {
  try {
    const sourceFilePath = req.file.path;
    const { templateId, mappings, format } = req.body;
    // Parse mappings JSON if it's a string
    const parsedMappings = typeof mappings === 'string' ? JSON.parse(mappings) : mappings;
    // Retrieve template definition from DB (or you may adapt to your existing method)
    const template = await Database.get('SELECT * FROM templates WHERE id = ?', [templateId]);
    // Pass format via options
    const options = { outputFormat: format || 'xlsx' };
    const result = await TransformationService.transformData(sourceFilePath, templateId, parsedMappings, options);
    res.json(result);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const TemplateDiscoveryService = require('../services/TemplateDiscoveryService');
const SourceAnalyzerService = require('../services/SourceAnalyzerService');
const MatchingEngineService = require('../services/MatchingEngineService');
const TransformationService = require('../services/TransformationService');
const Database = require('../database/database');

const upload = multer({ dest: 'uploads/templates/' });

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

// Phase 4-5: Transform data
router.post('/generate', async (req, res) => {
    try {
        const { sourceFilePath, templateId, mappings } = req.body;
        
        const template = await Database.get(
            'SELECT * FROM templates WHERE id = ?',
            [templateId]
        );
        
        const result = await TransformationService.transformData(
            sourceFilePath,
            template,
            mappings,
            null
        );
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
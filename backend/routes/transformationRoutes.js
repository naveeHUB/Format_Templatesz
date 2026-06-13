const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TemplateAnalyzer = require('../services/TemplateAnalyzer');
const MatchingEngine = require('../services/MatchingEngine');
const MappingService = require('../services/MappingService');
const TransformationService = require('../services/TransformationService');

const upload = multer({ dest: 'uploads/templates/' });
const sourceUpload = multer({ dest: 'uploads/sources/' });

// Analyze template workbook
router.post('/analyze-template', upload.single('file'), async (req, res) => {
    try {
        const { templateId, templateName } = req.body;
        const structure = await TemplateAnalyzer.analyzeTemplate(
            req.file.path,
            templateId,
            templateName
        );
        res.json(structure);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Match source with template
router.post('/match-template', async (req, res) => {
    try {
        const { sourceHeaders, templateId } = req.body;
        
        let templates = [];
        if (templateId) {
            const templateFile = path.join(__dirname, `../data/templates/${templateId}.json`);
            if (fs.existsSync(templateFile)) {
                templates = [JSON.parse(fs.readFileSync(templateFile, 'utf8'))];
            }
        } else {
            const templatesDir = path.join(__dirname, '../data/templates');
            const files = fs.readdirSync(templatesDir);
            templates = files.map(file => JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf8')));
        }
        
        const matches = MatchingEngine.findBestTemplate(sourceHeaders, templates);
        res.json(matches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get mappings for template
router.get('/mappings/:templateId', (req, res) => {
    const mappings = MappingService.getMappings(req.params.templateId);
    res.json(mappings);
});

// Save mappings
router.post('/mappings/:templateId', (req, res) => {
    const { mappings, sheetName } = req.body;
    const saved = MappingService.saveBatchMappings(req.params.templateId, mappings, sheetName);
    res.json({ success: true, mappings: saved });
});

// Transform data and generate output
router.post('/transform', sourceUpload.single('file'), async (req, res) => {
    try {
        const { templateId, mappings } = req.body;
        const parsedMappings = JSON.parse(mappings);
        
        const result = await TransformationService.transformData(
            req.file.path,
            templateId,
            parsedMappings
        );
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download generated file
router.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, '../uploads/generated', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

module.exports = router;
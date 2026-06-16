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
        // Persist the original uploaded template workbook for later transformation
const savedTemplatePath = path.join(__dirname, `../uploads/templates/${templateId}.xlsx`);
// Ensure the uploads/templates directory exists (already created in server.js)
try {
    const fs = require('fs');
    // Rename (move) the uploaded file to the desired permanent name
    fs.renameSync(req.file.path, savedTemplatePath);
} catch (copyErr) {
    console.error('Failed to move template workbook:', copyErr);
}        
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
        const { templateId, mappings, outputFormat, format } = req.body;
        const targetFormat = format || outputFormat;
        const parsedMappings = JSON.parse(mappings);
        
        const result = await TransformationService.transformData(
            req.file.path,
            templateId,
            parsedMappings,
            { outputFormat: targetFormat }
        );
        
        // After transformation, delete the temporary source file
        try { fs.unlinkSync(req.file.path); } catch (e) { console.warn('Could not delete temp source file:', e); }
        
        res.json({
            ...result,
            downloadUrl: `/api/download/${result.outputFilename}`,
            outputFormat: targetFormat
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download generated file
    router.get('/download/:filename', (req, res) => {
        const filePath = path.join(__dirname, '../uploads/generated', req.params.filename);
        if (fs.existsSync(filePath)) {
            // Determine MIME type based on file extension
            const ext = path.extname(req.params.filename).toLowerCase();
            let mimeType = 'application/octet-stream';
            if (ext === '.xlsx') {
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            } else if (ext === '.xls') {
                mimeType = 'application/vnd.ms-excel';
            } else if (ext === '.pdf') {
                mimeType = 'application/pdf';
            } else if (ext === '.pptx') {
                mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            } else if (ext === '.ppt') {
                mimeType = 'application/vnd.ms-powerpoint';
            }
            res.setHeader('Content-Type', mimeType);
            res.download(filePath);
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    });

module.exports = router;
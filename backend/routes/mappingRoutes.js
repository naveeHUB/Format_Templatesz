const express = require('express');
const router = express.Router();
const mappingEngine = require('../services/mappingEngine');
const templateRegistry = require('../services/templateRegistry');

/**
 * POST /api/mapping/analyze
 * Analyze mapping between source headers and template fields
 */
router.post('/analyze', (req, res) => {
    try {
        const { sourceHeaders, templateId } = req.body;
        
        if (!sourceHeaders || !Array.isArray(sourceHeaders)) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid sourceHeaders array'
            });
        }
        
        let templateFields = [];
        
        if (templateId) {
            // Get template from registry
            const template = templateRegistry.getTemplateById(templateId);
            if (template && template.sheets && template.sheets[0]) {
                templateFields = template.sheets[0].fields;
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'Template not found'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                error: 'Missing templateId'
            });
        }
        
        const analysis = mappingEngine.analyzeMapping(sourceHeaders, templateFields);
        
        res.json({
            success: true,
            analysis: analysis
        });
        
    } catch (error) {
        console.error('[MappingRoutes] Analyze error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze mapping',
            details: error.message
        });
    }
});

/**
 * POST /api/mapping/approve
 * Approve and save mapping profile
 */
router.post('/approve', (req, res) => {
    try {
        const { templateId, mappings, overrides } = req.body;
        
        if (!templateId) {
            return res.status(400).json({
                success: false,
                error: 'Missing templateId'
            });
        }
        
        // Get template
        const template = templateRegistry.getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        
        // Get source headers from template or request
        const sourceHeaders = req.body.sourceHeaders || [];
        const templateFields = template.sheets[0].fields;
        
        // Analyze mapping
        let analysis = mappingEngine.analyzeMapping(sourceHeaders, templateFields);
        
        // Apply overrides if provided
        if (overrides && overrides.length > 0) {
            analysis = mappingEngine.applyMappingOverrides(analysis, overrides);
        }
        
        // Create mapping profile
        const mappingProfile = mappingEngine.createMappingProfile(templateId, analysis);
        
        // Save mapping profile to template registry
        const updatedTemplate = templateRegistry.updateTemplate(templateId, {
            mappingProfile: mappingProfile,
            mappingApproved: true,
            mappingConfig: mappingEngine.getMappingConfig(mappingProfile)
        });
        
        res.json({
            success: true,
            message: 'Mapping profile approved and saved',
            mappingProfile: mappingProfile,
            template: updatedTemplate
        });
        
    } catch (error) {
        console.error('[MappingRoutes] Approve error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve mapping',
            details: error.message
        });
    }
});

/**
 * GET /api/mapping/profile/:templateId
 * Get saved mapping profile
 */
router.get('/profile/:templateId', (req, res) => {
    try {
        const { templateId } = req.params;
        
        const template = templateRegistry.getTemplateById(templateId);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        
        const mappingProfile = template.mappingProfile || null;
        
        res.json({
            success: true,
            mappingProfile: mappingProfile,
            mappingConfig: template.mappingConfig || null,
            approved: template.mappingApproved || false
        });
        
    } catch (error) {
        console.error('[MappingRoutes] Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get mapping profile'
        });
    }
});

/**
 * PUT /api/mapping/profile/:templateId
 * Update mapping profile
 */
router.put('/profile/:templateId', (req, res) => {
    try {
        const { templateId } = req.params;
        const { mappings, overrides } = req.body;
        
        const template = templateRegistry.getTemplateById(templateId);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        
        let mappingProfile = template.mappingProfile || {};
        
        if (mappings) {
            mappingProfile.mappings = mappings;
        }
        
        if (overrides) {
            const analysis = { mappings: mappingProfile.mappings || [] };
            const updated = mappingEngine.applyMappingOverrides(analysis, overrides);
            mappingProfile.mappings = updated.mappings;
        }
        
        mappingProfile.updatedAt = new Date().toISOString();
        mappingProfile.approved = false; // Needs re-approval
        
        const updatedTemplate = templateRegistry.updateTemplate(templateId, {
            mappingProfile: mappingProfile,
            mappingApproved: false,
            mappingConfig: mappingEngine.getMappingConfig(mappingProfile)
        });
        
        res.json({
            success: true,
            message: 'Mapping profile updated',
            mappingProfile: mappingProfile,
            template: updatedTemplate
        });
        
    } catch (error) {
        console.error('[MappingRoutes] Update profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update mapping profile'
        });
    }
});

/**
 * GET /api/mapping/aliases
 * Get alias definitions
 */
router.get('/aliases', (req, res) => {
    try {
        const mappingEngine = require('../services/mappingEngine');
        mappingEngine.loadAliases();
        
        res.json({
            success: true,
            aliases: require('../config/mappingAliases.json')
        });
        
    } catch (error) {
        console.error('[MappingRoutes] Get aliases error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get aliases'
        });
    }
});

module.exports = router;
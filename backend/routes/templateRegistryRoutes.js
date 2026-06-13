const express = require('express');
const router = express.Router();
const registryService = require('../services/templateRegistry');

/**
 * POST /api/templates/registry
 * Save a new template to registry
 */
router.post('/registry', (req, res) => {
    try {
        const { templateModel } = req.body;
        
        if (!templateModel) {
            return res.status(400).json({
                success: false,
                error: 'Missing templateModel in request body'
            });
        }
        
        const savedTemplate = registryService.saveTemplate(templateModel);
        
        res.status(201).json({
            success: true,
            message: 'Template saved successfully',
            templateId: savedTemplate.templateId,
            template: savedTemplate
        });
    } catch (error) {
        console.error('[RegistryRoutes] POST error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save template',
            details: error.message
        });
    }
});

/**
 * GET /api/templates/registry
 * Get all templates
 */
router.get('/registry', (req, res) => {
    try {
        const templates = registryService.getAllTemplates();
        res.json({
            success: true,
            count: templates.length,
            templates: templates
        });
    } catch (error) {
        console.error('[RegistryRoutes] GET all error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve templates'
        });
    }
});

/**
 * GET /api/templates/registry/approved
 * Get approved templates only
 */
router.get('/registry/approved', (req, res) => {
    try {
        const templates = registryService.getApprovedTemplates();
        res.json({
            success: true,
            count: templates.length,
            templates: templates
        });
    } catch (error) {
        console.error('[RegistryRoutes] GET approved error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve approved templates'
        });
    }
});

/**
 * GET /api/templates/registry/:id
 * Get template by ID
 */
router.get('/registry/:id', (req, res) => {
    try {
        const { id } = req.params;
        const template = registryService.getTemplateById(id);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        
        res.json({
            success: true,
            template: template
        });
    } catch (error) {
        console.error('[RegistryRoutes] GET by id error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve template'
        });
    }
});

/**
 * PUT /api/templates/registry/:id/approve
 * Approve a template
 */
router.put('/registry/:id/approve', (req, res) => {
    try {
        const { id } = req.params;
        const template = registryService.approveTemplate(id);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Template approved successfully',
            template: template
        });
    } catch (error) {
        console.error('[RegistryRoutes] Approve error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve template'
        });
    }
});

/**
 * DELETE /api/templates/registry/:id
 * Delete a template
 */
router.delete('/registry/:id', (req, res) => {
    try {
        const { id } = req.params;
        const deleted = registryService.deleteTemplate(id);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Template deleted successfully'
        });
    } catch (error) {
        console.error('[RegistryRoutes] DELETE error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete template'
        });
    }
});

/**
 * PUT /api/templates/registry/:id
 * Update template
 */
router.put('/registry/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { updates } = req.body;
        
        if (!updates) {
            return res.status(400).json({
                success: false,
                error: 'Missing updates in request body'
            });
        }
        
        const template = registryService.updateTemplate(id, updates);
        
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Template updated successfully',
            template: template
        });
    } catch (error) {
        console.error('[RegistryRoutes] UPDATE error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update template'
        });
    }
});

module.exports = router;
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const REGISTRY_FILE_PATH = path.join(__dirname, '..', 'config', 'templates.registry.json');

/**
 * Initialize registry file if it doesn't exist
 */
function initRegistry() {
    const configDir = path.join(__dirname, '..', 'config');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (!fs.existsSync(REGISTRY_FILE_PATH)) {
        const defaultRegistry = {
            version: "1.0",
            templates: []
        };
        fs.writeFileSync(REGISTRY_FILE_PATH, JSON.stringify(defaultRegistry, null, 2));
        console.log('[TemplateRegistry] Created new registry file');
    }
}

/**
 * Load all templates from registry
 */
function loadRegistry() {
    try {
        initRegistry();
        const data = fs.readFileSync(REGISTRY_FILE_PATH, 'utf8');
        const registry = JSON.parse(data);
        return registry.templates || [];
    } catch (error) {
        console.error('[TemplateRegistry] Error loading registry:', error);
        return [];
    }
}

/**
 * Save templates to registry
 */
function saveRegistry(templates) {
    try {
        const registry = {
            version: "1.0",
            lastUpdated: new Date().toISOString(),
            templates: templates
        };
        fs.writeFileSync(REGISTRY_FILE_PATH, JSON.stringify(registry, null, 2));
        return true;
    } catch (error) {
        console.error('[TemplateRegistry] Error saving registry:', error);
        return false;
    }
}

/**
 * Save a new template to registry
 */
function saveTemplate(templateModel) {
    const templates = loadRegistry();
    
    const existingIndex = templates.findIndex(t => t.templateName === templateModel.templateName);
    
    const newTemplate = {
        templateId: uuidv4(),
        templateName: templateModel.templateName || templateModel.fileName,
        version: "1.0",
        approved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceFile: templateModel.fileName,
        mappingProfile: null,
        mappingApproved: false,
        mappingConfig: null,
        sheets: templateModel.sheets.map(sheet => ({
            name: sheet.name,
            headerRow: sheet.headerRow,
            dataStartRow: sheet.dataStartRow,
            dataEndRow: sheet.dataEndRow,
            fields: sheet.fields.map(field => ({
                id: field.id,
                name: field.name,
                column: field.column,
                required: field.required || false,
                detected: field.detected
            })),
            formulaFields: sheet.formulaFields || [],
            mergedCells: sheet.mergedCells || [],
            summarySections: sheet.summarySections || []
        }))
    };
    
    if (existingIndex !== -1) {
        newTemplate.templateId = templates[existingIndex].templateId;
        newTemplate.createdAt = templates[existingIndex].createdAt;
        templates[existingIndex] = newTemplate;
    } else {
        templates.push(newTemplate);
    }
    
    saveRegistry(templates);
    return newTemplate;
}

/**
 * Get all templates
 */
function getAllTemplates() {
    return loadRegistry();
}

/**
 * Get template by ID
 */
function getTemplateById(templateId) {
    const templates = loadRegistry();
    return templates.find(t => t.templateId === templateId) || null;
}

/**
 * Update template
 */
function updateTemplate(templateId, updates) {
    const templates = loadRegistry();
    const index = templates.findIndex(t => t.templateId === templateId);
    
    if (index === -1) {
        return null;
    }
    
    templates[index] = {
        ...templates[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    saveRegistry(templates);
    return templates[index];
}

/**
 * Approve template
 */
function approveTemplate(templateId) {
    return updateTemplate(templateId, { approved: true });
}

/**
 * Delete template
 */
function deleteTemplate(templateId) {
    const templates = loadRegistry();
    const filtered = templates.filter(t => t.templateId !== templateId);
    
    if (filtered.length === templates.length) {
        return false;
    }
    
    saveRegistry(filtered);
    return true;
}

/**
 * Get approved templates only
 */
function getApprovedTemplates() {
    const templates = loadRegistry();
    return templates.filter(t => t.approved === true);
}

module.exports = {
    initRegistry,
    loadRegistry,
    saveTemplate,
    getAllTemplates,
    getTemplateById,
    updateTemplate,
    approveTemplate,
    deleteTemplate,
    getApprovedTemplates
};
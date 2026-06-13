const fs = require('fs');
const path = require('path');

// Load alias configuration
const ALIASES_PATH = path.join(__dirname, '..', 'config', 'mappingAliases.json');
let aliases = {};

function loadAliases() {
    try {
        if (fs.existsSync(ALIASES_PATH)) {
            const data = fs.readFileSync(ALIASES_PATH, 'utf8');
            const config = JSON.parse(data);
            aliases = config.aliases || {};
        } else {
            // Default aliases
            aliases = {
                "CUSTOMER": ["customer", "client", "customer name", "account"],
                "ITEM": ["item", "product", "part number", "sku"],
                "Sales Plan Qty": ["quantity", "qty", "units"],
                "Sale Plan Value": ["value", "amount", "total", "price"]
            };
        }
    } catch (error) {
        console.error('[MappingEngine] Error loading aliases:', error);
        aliases = {};
    }
}

loadAliases();

/**
 * Calculate confidence score for a match
 * @param {string} source - Source field name
 * @param {string} target - Target field name
 * @returns {number} Confidence score (0-100)
 */
function calculateConfidence(source, target) {
    const sourceLower = source.toLowerCase().trim();
    const targetLower = target.toLowerCase().trim();
    
    // 1. Exact match (case-sensitive) - 100%
    if (source === target) {
        return 100;
    }
    
    // 2. Case-insensitive exact match - 98%
    if (sourceLower === targetLower) {
        return 98;
    }
    
    // 3. Alias match - 95%
    const targetAliases = aliases[target] || [];
    for (const alias of targetAliases) {
        if (sourceLower === alias.toLowerCase()) {
            return 95;
        }
    }
    
    // 4. Partial match (source contains target or vice versa) - 70%
    if (sourceLower.includes(targetLower) || targetLower.includes(sourceLower)) {
        return 70;
    }
    
    // 5. Word match (common words) - 60%
    const sourceWords = sourceLower.split(/[\s_\-]+/);
    const targetWords = targetLower.split(/[\s_\-]+/);
    const commonWords = sourceWords.filter(w => targetWords.includes(w));
    if (commonWords.length > 0) {
        return 60;
    }
    
    // 6. No match - 0%
    return 0;
}

/**
 * Analyze mapping between source headers and template fields
 * @param {string[]} sourceHeaders - Headers from uploaded file
 * @param {object[]} templateFields - Fields from template registry
 * @returns {object} Mapping analysis result
 */
function analyzeMapping(sourceHeaders, templateFields) {
    const mappings = [];
    const mappedSourceFields = new Set();
    const mappedTemplateFields = new Set();
    
    // Extract template field names
    const templateFieldNames = templateFields.map(f => f.name);
    
    // For each source header, find best matching template field
    for (const source of sourceHeaders) {
        if (!source || source.trim() === '') continue;
        
        let bestMatch = null;
        let bestConfidence = 0;
        
        for (const templateField of templateFields) {
            const confidence = calculateConfidence(source, templateField.name);
            
            if (confidence > bestConfidence && confidence >= 50) { // Only consider matches with 50%+ confidence
                bestConfidence = confidence;
                bestMatch = templateField;
            }
        }
        
        if (bestMatch) {
            mappings.push({
                sourceField: source,
                targetField: bestMatch.name,
                targetId: bestMatch.id,
                confidence: bestConfidence,
                required: bestMatch.required || false
            });
            mappedSourceFields.add(source);
            mappedTemplateFields.add(bestMatch.name);
        } else {
            mappings.push({
                sourceField: source,
                targetField: null,
                confidence: 0,
                required: false
            });
        }
    }
    
    // Identify unmapped template fields
    const unmappedTemplateFields = templateFieldNames.filter(
        f => !mappedTemplateFields.has(f)
    );
    
    // Identify unmapped source fields (confidence < 50)
    const unmappedSourceFields = mappings
        .filter(m => m.confidence < 50)
        .map(m => m.sourceField);
    
    // Calculate overall confidence score
    const totalMappings = mappings.length;
    const highConfidenceMappings = mappings.filter(m => m.confidence >= 80).length;
    const overallConfidence = totalMappings > 0 
        ? Math.round((highConfidenceMappings / totalMappings) * 100)
        : 0;
    
    return {
        mappings: mappings.filter(m => m.confidence >= 50),
        lowConfidenceMappings: mappings.filter(m => m.confidence > 0 && m.confidence < 80),
        unmappedSourceFields: unmappedSourceFields,
        unmappedTemplateFields: unmappedTemplateFields,
        overallConfidence: overallConfidence,
        totalSourceFields: sourceHeaders.length,
        totalTemplateFields: templateFieldNames.length,
        mappedCount: mappings.filter(m => m.confidence >= 50).length
    };
}

/**
 * Validate and apply manual mapping overrides
 * @param {object} analysis - Original mapping analysis
 * @param {array} overrides - Manual mapping overrides
 * @returns {object} Updated mapping
 */
function applyMappingOverrides(analysis, overrides) {
    const updatedMappings = [...analysis.mappings];
    
    for (const override of overrides) {
        const index = updatedMappings.findIndex(m => m.sourceField === override.sourceField);
        
        if (index !== -1) {
            updatedMappings[index] = {
                ...updatedMappings[index],
                targetField: override.targetField,
                confidence: 100, // Manual override gets 100% confidence
                manualOverride: true
            };
        } else {
            // Add new mapping
            updatedMappings.push({
                sourceField: override.sourceField,
                targetField: override.targetField,
                confidence: 100,
                required: override.required || false,
                manualOverride: true
            });
        }
    }
    
    return {
        ...analysis,
        mappings: updatedMappings,
        overallConfidence: 100, // Manual overrides make it 100%
        hasManualOverrides: true
    };
}

/**
 * Create mapping profile for template
 * @param {string} templateId - Template ID
 * @param {object} mappingResult - Mapping analysis result
 * @returns {object} Mapping profile
 */
function createMappingProfile(templateId, mappingResult) {
    return {
        profileId: `map_${Date.now()}`,
        templateId: templateId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mappings: mappingResult.mappings,
        unmappedSourceFields: mappingResult.unmappedSourceFields,
        unmappedTemplateFields: mappingResult.unmappedTemplateFields,
        overallConfidence: mappingResult.overallConfidence,
        approved: false
    };
}

/**
 * Get mapping instructions for template engine
 * @param {object} mappingProfile - Approved mapping profile
 * @returns {object} Mapping config for template engine
 */
function getMappingConfig(mappingProfile) {
    const mappingConfig = {};
    
    for (const mapping of mappingProfile.mappings) {
        if (mapping.targetField) {
            mappingConfig[mapping.targetField] = mapping.sourceField;
        }
    }
    
    return mappingConfig;
}

module.exports = {
    analyzeMapping,
    applyMappingOverrides,
    createMappingProfile,
    getMappingConfig,
    calculateConfidence,
    loadAliases
};
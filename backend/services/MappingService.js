const fs = require('fs');
const path = require('path');

class MappingService {
    constructor() {
        this.mappingsFile = path.join(__dirname, '../data/mappings.json');
        this.loadMappings();
    }
    
    loadMappings() {
        if (fs.existsSync(this.mappingsFile)) {
            this.mappings = JSON.parse(fs.readFileSync(this.mappingsFile, 'utf8'));
        } else {
            this.mappings = {};
            this.saveMappings();
        }
    }
    
    saveMappings() {
        fs.writeFileSync(this.mappingsFile, JSON.stringify(this.mappings, null, 2));
    }
    
    getMappings(templateId) {
        return this.mappings[templateId] || {};
    }
    
    saveMapping(templateId, sourceHeader, targetHeader, sheetName = null) {
        if (!this.mappings[templateId]) {
            this.mappings[templateId] = {};
        }
        
        const key = sheetName ? `${sheetName}:${sourceHeader}` : sourceHeader;
        this.mappings[templateId][key] = targetHeader;
        this.saveMappings();
        
        return this.mappings[templateId];
    }
    
    saveBatchMappings(templateId, mappings, sheetName = null) {
        if (!this.mappings[templateId]) {
            this.mappings[templateId] = {};
        }
        
        for (const [source, target] of Object.entries(mappings)) {
            const key = sheetName ? `${sheetName}:${source}` : source;
            this.mappings[templateId][key] = target;
        }
        
        this.saveMappings();
        return this.mappings[templateId];
    }
    
    applyMappings(sourceHeaders, templateId, sheetName = null) {
        const savedMappings = this.getMappings(templateId);
        const applied = [];
        
        for (const sourceHeader of sourceHeaders) {
            const key = sheetName ? `${sheetName}:${sourceHeader}` : sourceHeader;
            const mappedField = savedMappings[key];
            
            applied.push({
                source: sourceHeader,
                target: mappedField || null,
                isMapped: !!mappedField
            });
        }
        
        return applied;
    }
    
    deleteMapping(templateId, sourceHeader, sheetName = null) {
        if (this.mappings[templateId]) {
            const key = sheetName ? `${sheetName}:${sourceHeader}` : sourceHeader;
            delete this.mappings[templateId][key];
            this.saveMappings();
        }
    }
}

module.exports = new MappingService();
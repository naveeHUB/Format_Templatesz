const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.templatesFile = path.join(this.dataDir, 'templates.json');
        this.mappingsFile = path.join(this.dataDir, 'mappings.json');
        this.historyFile = path.join(this.dataDir, 'history.json');
        this.synonymsFile = path.join(this.dataDir, 'synonyms.json');
        
        this.ensureDataDir();
        this.initFiles();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    initFiles() {
        // Initialize templates.json
        if (!fs.existsSync(this.templatesFile)) {
            fs.writeFileSync(this.templatesFile, JSON.stringify([], null, 2));
        }

        // Initialize mappings.json
        if (!fs.existsSync(this.mappingsFile)) {
            fs.writeFileSync(this.mappingsFile, JSON.stringify({}, null, 2));
        }

        // Initialize history.json
        if (!fs.existsSync(this.historyFile)) {
            fs.writeFileSync(this.historyFile, JSON.stringify([], null, 2));
        }

        // Initialize synonyms.json with default values
        if (!fs.existsSync(this.synonymsFile)) {
            const defaultSynonyms = {
                "Customer Name": ["Customer", "Client", "Client Name", "Customer ID"],
                "Part Number": ["Part No", "Part Code", "Material Code", "SKU"],
                "Quantity": ["Qty", "QTY", "Quantity", "Count"],
                "Amount": ["Value", "Total", "Amount USD", "Price"],
                "Date": ["Date", "Transaction Date", "Order Date"],
                "Product": ["Product Name", "Item", "Description"],
                "Region": ["Area", "Territory", "Location"]
            };
            fs.writeFileSync(this.synonymsFile, JSON.stringify(defaultSynonyms, null, 2));
        }
    }

    // Template operations
    async getTemplates() {
        const data = fs.readFileSync(this.templatesFile, 'utf8');
        return JSON.parse(data);
    }

    async saveTemplates(templates) {
        fs.writeFileSync(this.templatesFile, JSON.stringify(templates, null, 2));
        return true;
    }

    async getTemplateById(id) {
        const templates = await this.getTemplates();
        return templates.find(t => t.id === parseInt(id));
    }

    async createTemplate(templateData) {
        const templates = await this.getTemplates();
        const newId = templates.length > 0 ? Math.max(...templates.map(t => t.id)) + 1 : 1;
        
        const newTemplate = {
            id: newId,
            ...templateData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };
        
        templates.push(newTemplate);
        await this.saveTemplates(templates);
        return newTemplate;
    }

    async updateTemplate(id, updates) {
        const templates = await this.getTemplates();
        const index = templates.findIndex(t => t.id === parseInt(id));
        
        if (index === -1) return null;
        
        templates[index] = {
            ...templates[index],
            ...updates,
            updatedAt: new Date().toISOString(),
            version: templates[index].version + 1
        };
        
        await this.saveTemplates(templates);
        return templates[index];
    }

    async deleteTemplate(id) {
        const templates = await this.getTemplates();
        const filtered = templates.filter(t => t.id !== parseInt(id));
        
        if (filtered.length === templates.length) return false;
        
        await this.saveTemplates(filtered);
        return true;
    }

    // Mapping operations
    async getMappings(templateId) {
        const mappings = JSON.parse(fs.readFileSync(this.mappingsFile, 'utf8'));
        return mappings[templateId] || {};
    }

    async saveMapping(templateId, sourceHeader, targetHeader) {
        const mappings = JSON.parse(fs.readFileSync(this.mappingsFile, 'utf8'));
        
        if (!mappings[templateId]) {
            mappings[templateId] = {};
        }
        
        mappings[templateId][sourceHeader] = targetHeader;
        fs.writeFileSync(this.mappingsFile, JSON.stringify(mappings, null, 2));
        return mappings[templateId];
    }

    async saveMultipleMappings(templateId, mappingsObj) {
        const mappings = JSON.parse(fs.readFileSync(this.mappingsFile, 'utf8'));
        
        if (!mappings[templateId]) {
            mappings[templateId] = {};
        }
        
        mappings[templateId] = { ...mappings[templateId], ...mappingsObj };
        fs.writeFileSync(this.mappingsFile, JSON.stringify(mappings, null, 2));
        return mappings[templateId];
    }

    async deleteMapping(templateId, sourceHeader) {
        const mappings = JSON.parse(fs.readFileSync(this.mappingsFile, 'utf8'));
        
        if (mappings[templateId] && mappings[templateId][sourceHeader]) {
            delete mappings[templateId][sourceHeader];
            fs.writeFileSync(this.mappingsFile, JSON.stringify(mappings, null, 2));
            return true;
        }
        return false;
    }

    // History operations
    async addHistory(record) {
        const history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
        history.unshift({
            ...record,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 records
        const trimmed = history.slice(0, 100);
        fs.writeFileSync(this.historyFile, JSON.stringify(trimmed, null, 2));
        return true;
    }

    async getHistory(limit = 50) {
        const history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
        return history.slice(0, limit);
    }

    // Synonym operations
    async getSynonyms() {
        const synonyms = JSON.parse(fs.readFileSync(this.synonymsFile, 'utf8'));
        return synonyms;
    }

    async addSynonym(standardTerm, synonym) {
        const synonyms = await this.getSynonyms();
        
        if (!synonyms[standardTerm]) {
            synonyms[standardTerm] = [];
        }
        
        if (!synonyms[standardTerm].includes(synonym)) {
            synonyms[standardTerm].push(synonym);
            fs.writeFileSync(this.synonymsFile, JSON.stringify(synonyms, null, 2));
        }
        
        return synonyms;
    }

    // Query method for compatibility
    async query(sql, params = []) {
        // This is a mock method for backward compatibility
        console.warn('SQL query called but using JSON storage:', sql);
        return [];
    }

    async get(sql, params = []) {
        console.warn('SQL get called but using JSON storage:', sql);
        return null;
    }

    async run(sql, params = []) {
        console.warn('SQL run called but using JSON storage:', sql);
        return { lastID: 1, changes: 1 };
    }
}

module.exports = new Database();
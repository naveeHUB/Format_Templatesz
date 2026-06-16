// backend/services/TemplateRegistryService.js
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Registry file location (relative to project root)
const registryFile = path.join(__dirname, '../data/templateRegistry.json');

class TemplateRegistryService {
  constructor() {
    this._ensureRegistryFile();
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------
  _ensureRegistryFile() {
    if (!fs.existsSync(registryFile)) {
      // Create an empty registry with pretty‑printed JSON
      this._atomicWrite(JSON.stringify([], null, 2));
      console.log('[TEMPLATE REGISTRY] Created new registry file');
    }
  }

  _readRegistry() {
    const raw = fs.readFileSync(registryFile, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('[TEMPLATE REGISTRY] Corrupted JSON, resetting file');
      // Reset to empty array to avoid crash
      this._atomicWrite(JSON.stringify([], null, 2));
      return [];
    }
  }

  _atomicWrite(content) {
    // Write to a temporary file then rename – avoids partial writes.
    const tmpPath = `${registryFile}.tmp`;
    fs.writeFileSync(tmpPath, content, { encoding: 'utf8' });
    fs.renameSync(tmpPath, registryFile);
  }

  _saveRegistry(registry) {
    this._atomicWrite(JSON.stringify(registry, null, 2));
  }

  _validateEntry(entry, isUpdate = false) {
    const required = ['name', 'type', 'templateFile'];
    for (const field of required) {
      if (!entry[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    const validTypes = ['excel', 'pptx', 'pdf'];
    if (!validTypes.includes(entry.type)) {
      throw new Error(`Invalid template type: ${entry.type}`);
    }
    // Duplicate protection on create only
    if (!isUpdate) {
      const registry = this._readRegistry();
      const duplicateName = registry.find(r => r.name === entry.name);
      if (duplicateName) {
        throw new Error('Duplicate template name');
      }
      const duplicateFile = registry.find(r => r.templateFile === entry.templateFile);
      if (duplicateFile) {
        throw new Error('Duplicate template file');
      }
    }
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  list() {
    return this._readRegistry();
  }

  get(id) {
    const registry = this._readRegistry();
    return registry.find(r => r.id === id) || null;
  }

  create(entry) {
    this._validateEntry(entry);
    const now = new Date().toISOString();
    const newRecord = {
      id: uuidv4(),
      name: entry.name,
      description: entry.description || '',
      category: entry.category || '',
      type: entry.type,
      templateFile: entry.templateFile,
      templateStructureFile: entry.templateStructureFile || '',
      createdAt: now,
      updatedAt: now
    };
    const registry = this._readRegistry();
    registry.push(newRecord);
    this._saveRegistry(registry);
    console.log(`[TEMPLATE CREATED] ID=${newRecord.id} Name=${newRecord.name}`);
    return newRecord;
  }

  update(id, updates) {
    const registry = this._readRegistry();
    const idx = registry.findIndex(r => r.id === id);
    if (idx === -1) {
      throw new Error('Template not found');
    }
    const existing = registry[idx];
    const merged = { ...existing, ...updates };
    this._validateEntry(merged, true);
    merged.updatedAt = new Date().toISOString();
    registry[idx] = merged;
    this._saveRegistry(registry);
    console.log(`[TEMPLATE UPDATED] ID=${id} Name=${merged.name}`);
    return merged;
  }

  delete(id, options = { removeFiles: false }) {
    const registry = this._readRegistry();
    const idx = registry.findIndex(r => r.id === id);
    if (idx === -1) {
      throw new Error('Template not found');
    }
    const [removed] = registry.splice(idx, 1);
    this._saveRegistry(registry);
    console.log(`[TEMPLATE DELETED] ID=${id} Name=${removed.name}`);

    if (options.removeFiles) {
      // Remove template workbook file
      if (removed.templateFile && fs.existsSync(removed.templateFile)) {
        fs.unlinkSync(removed.templateFile);
        console.log(`[FILE REMOVED] ${removed.templateFile}`);
      }
      // Remove structure JSON if present
      if (removed.templateStructureFile && fs.existsSync(removed.templateStructureFile)) {
        fs.unlinkSync(removed.templateStructureFile);
        console.log(`[FILE REMOVED] ${removed.templateStructureFile}`);
      }
    }
    return removed;
  }
}

module.exports = new TemplateRegistryService();

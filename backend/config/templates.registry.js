const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'templates.registry.json');

function loadRegistry() {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      // Return empty array if file does not exist, or write default
      fs.writeFileSync(REGISTRY_PATH, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const data = fs.readFileSync(REGISTRY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading template registry:', error);
    return [];
  }
}

function saveRegistry(templates) {
  try {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(templates, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving template registry:', error);
    return false;
  }
}

function getTemplate(templateId) {
  const templates = loadRegistry();
  return templates.find(t => t.templateId === templateId) || null;
}

function registerTemplate(templateConfig) {
  const templates = loadRegistry();
  const index = templates.findIndex(t => t.templateId === templateConfig.templateId);
  if (index !== -1) {
    templates[index] = templateConfig;
  } else {
    templates.push(templateConfig);
  }
  return saveRegistry(templates);
}

function removeTemplate(templateId) {
  const templates = loadRegistry();
  const filtered = templates.filter(t => t.templateId !== templateId);
  return saveRegistry(filtered);
}

module.exports = {
  loadRegistry,
  saveRegistry,
  getTemplate,
  registerTemplate,
  removeTemplate
};

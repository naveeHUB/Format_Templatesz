const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const XLSX = require('xlsx');

// templateRoutes removed - file missing, will re-implement in Phase 4
// const templateRoutes = require('./routes/templateRoutes');
const generateRoutes = require('./routes/generateRoutes');
const templateDiscoveryRoutes = require('./routes/templateDiscoveryRoutes');   // Phase 3 - Registry// Phase 2 - Discovery
const templateRegistryRoutes = require('./routes/templateRegistryRoutes');   // Phase 3 - Registry (ADD THIS LINE)

const app = express();
const PORT = process.env.PORT || 4000;

// Paths
const uploadFolder = path.join(__dirname, 'uploads');
const generatedFolder = path.join(uploadFolder, 'generated');
const templatesFolder = path.join(uploadFolder, 'templates');
const mappingRoutes = require('./routes/mappingRoutes');

// Only create essential folders
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}
if (!fs.existsSync(generatedFolder)) {
  fs.mkdirSync(generatedFolder, { recursive: true });
}
if (!fs.existsSync(templatesFolder)) {
  fs.mkdirSync(templatesFolder, { recursive: true });
}

// ==============================
// CREATE DEFAULT TEMPLATE IF MISSING
// ==============================
const templateFilePath = path.join(templatesFolder, 'sales_v1.xlsx');
const dynamicFolder = path.join(uploadFolder, 'dynamic');
if (!fs.existsSync(dynamicFolder)) {
    fs.mkdirSync(dynamicFolder, { recursive: true });
}
function createDefaultTemplate() {
  console.log('[Server] Creating default template file...');
  
  const workbook = XLSX.utils.book_new();
  const headers = [
    'CUSTOMER', 'CUSTOMER DESC.', 'ITEM', 'ITEM DESCRIPTION', 
    'Sales Plan Qty', 'Sale Plan Value'
  ];
  const sampleData = [
    'Sample Customer', 'Sample Description', 'Sample Item', 'Sample Item Desc',
    '100', '=E2*1000'
  ];
  const worksheetData = [headers, sampleData];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet['!cols'] = [
    { wch: 20 }, { wch: 30 }, { wch: 20 }, 
    { wch: 30 }, { wch: 15 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, templateFilePath);
  console.log('[Server] Default template created at:', templateFilePath);
}

if (!fs.existsSync(templateFilePath)) {
  try {
    createDefaultTemplate();
  } catch (error) {
    console.error('[Server] Failed to create default template:', error.message);
  }
} else {
  console.log('[Server] Template file found at:', templateFilePath);
}

// ==============================
// MIDDLEWARE
// ==============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(uploadFolder));
app.use('/api/mapping', mappingRoutes);
// ==============================
// ROUTES
// ==============================
// Discovery routes (Phase 2)
app.use('/api/templates', templateDiscoveryRoutes);
// Registry routes (Phase 3)
app.use('/api/templates', templateRegistryRoutes);
// Generation routes (Phase 1)
app.use('/', generateRoutes);

// ==============================
// ERROR HANDLER
// ==============================
app.use((err, req, res, next) => {
  console.error(err.stack || err.message);
  return res.status(500).json({
    error: err.message || 'Unexpected server error.'
  });
});

// ==============================
// START SERVER
// ==============================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sales Plan backend running at http://0.0.0.0:${PORT}`);
  console.log(`Upload folder: ${uploadFolder}`);
  console.log(`Generated folder: ${generatedFolder}`);
  console.log(`Templates folder: ${templatesFolder}`);
  console.log(`Discovery endpoint: http://0.0.0.0:${PORT}/api/templates/discover`);
  console.log(`Registry endpoints: http://0.0.0.0:${PORT}/api/templates/registry`);
});
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { discoverTemplate } = require('../services/discoveryEngine');

const router = express.Router();

// Configure multer for template uploads
const discoveryUploadFolder = path.join(__dirname, '..', 'uploads', 'discovery');

// Ensure discovery folder exists
if (!fs.existsSync(discoveryUploadFolder)) {
  fs.mkdirSync(discoveryUploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, discoveryUploadFolder);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-()_ ]/g, '_');
    cb(null, `discovery_${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

/**
 * POST /api/templates/discover
 * Upload and discover template structure
 */
router.post('/discover', upload.single('file'), async (req, res, next) => {
  try {
    console.log('[DiscoveryRoutes] POST /discover - started');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    console.log('[DiscoveryRoutes] File received:', req.file.originalname);
    
    // Discover template structure
    const templateModel = await discoverTemplate(req.file.path);
    
    // Clean up uploaded file after discovery
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('[DiscoveryRoutes] Could not delete temp file:', cleanupError.message);
    }
    
    console.log('[DiscoveryRoutes] Discovery completed successfully');
    
    return res.status(200).json({
      success: true,
      templateModel: templateModel
    });
    
  } catch (error) {
    console.error('[DiscoveryRoutes] Error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to discover template structure',
      details: error.message
    });
  }
});

/**
 * GET /api/templates/discover/health
 * Health check for discovery service
 */
router.get('/discover/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'template-discovery',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
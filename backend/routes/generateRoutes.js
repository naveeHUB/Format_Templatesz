const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parseFileName, isExcelFile } = require('../services/fileParser');
const { processWorkbook } = require('../services/templateEngine');

const router = express.Router();

// Folders config
const dataFolder = path.join(__dirname, '..', 'uploads', 'data');
const outputFolder = path.join(__dirname, '..', 'uploads', 'output');

if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder, { recursive: true });
}
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
}

// Multer storage for data files
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dataFolder),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-()_ ]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!isExcelFile(file.originalname)) {
      return cb(new Error('Invalid file type. Please upload an Excel workbook (.xlsx or .xls).'));
    }
    cb(null, true);
  },
  limits: { fileSize: 30 * 1024 * 1024 }
});

// Logger middleware for generation routes
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// POST: Upload file
router.post('/upload', upload.single('salesFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    console.log('[GenerateRoutes] File received for validation:', req.file.filename);
    const metadata = parseFileName(req.file.originalname);

    return res.status(200).json({
      message: 'File validated successfully.',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      detectedMonth: metadata.month,
      detectedYear: metadata.year,
      sheetName: metadata.sheetName
    });
  } catch (error) {
    console.error('[GenerateRoutes] Upload error:', error.message);
    return res.status(500).json({ error: error.message || 'Upload processing failed.' });
  }
});

// POST: Generate Excel template output
router.post('/generate', upload.single('salesFile'), async (req, res) => {
  try {
    console.log('[GenerateRoutes] Generation started. Body:', req.body);
    let uploadFileName = req.body.uploadFileName;
    let templateId = req.body.templateId || 'sales_v1';
    let sourcePath = null;
    let originalName = null;

    if (req.file) {
      sourcePath = req.file.path;
      originalName = req.file.originalname;
    } else if (uploadFileName) {
      const candidate = path.join(dataFolder, uploadFileName);
      if (!fs.existsSync(candidate)) {
        return res.status(404).json({ error: 'Uploaded data file not found on disk. Please upload again.' });
      }
      sourcePath = candidate;
      originalName = uploadFileName;
    } else {
      return res.status(400).json({ error: 'Missing uploaded file or filename identifier.' });
    }

    const metadata = parseFileName(originalName);
    const outputFileName = `Generated_${metadata.sheetName.replace(/[^a-zA-Z0-9 \-_]/g, '_')}.xlsx`;
    const outputPath = path.join(outputFolder, outputFileName);

    console.log(`[GenerateRoutes] Processing template ${templateId} with data ${sourcePath}`);

    const result = await processWorkbook({
      templateId,
      inputFilePath: sourcePath,
      outputFilePath: outputPath,
      customSheetName: metadata.sheetName
    });

    console.log('[GenerateRoutes] Process completed successfully');

    return res.status(200).json({
      message: 'Sales plan workbook generated successfully.',
      generatedFileName: outputFileName,
      sheetName: result.sheetName,
      totalRows: result.validation.totalRows,
      totalCustomers: result.summaryRows.length,
      summaryRows: result.summaryRows,
      validation: result.validation
    });
  } catch (error) {
    console.error('[GenerateRoutes] Generation error:', error);
    return res.status(500).json({ error: error.message || 'Workbook generation failed.' });
  }
});

// GET: Download generated file
router.get('/download', (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Missing download filename.' });
    }
    const filePath = path.join(outputFolder, path.basename(name));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Generated workbook not found on server.' });
    }
    return res.download(filePath);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET: Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

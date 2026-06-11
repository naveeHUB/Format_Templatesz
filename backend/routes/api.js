const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parseFileName, isExcelFile } = require('../services/fileParser');
const { processSalesPlanWorkbook } = require('../services/excelProcessor');

const router = express.Router();
// Simple request logger for debugging upload flow
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
const uploadFolder = path.join(__dirname, '..', '..', 'uploads');
const generatedFolder = path.join(uploadFolder, 'generated');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
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
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.post('/upload', upload.single('salesFile'), async (req, res, next) => {
  try {
    console.log('POST /upload - handler entered');
    if (!req.file) {
      console.warn('POST /upload - no file present on request');
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    console.log('POST /upload - file received:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path
    });

    const metadata = parseFileName(req.file.originalname);
    console.log('POST /upload - parsing metadata, detected:', metadata);

    return res.status(200).json({
      message: 'File validated successfully.',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      detectedMonth: metadata.month,
      detectedYear: metadata.year,
      sheetName: metadata.sheetName
    });
  } catch (error) {
    console.error('POST /upload - error:', error && error.message ? error.message : error);
    return res.status(500).json({ error: error.message || 'Upload processing failed.' });
  }
});

router.post('/generate', upload.single('salesFile'), async (req, res, next) => {
  try {
    console.log('POST /generate - handler entered');
    console.log('req.body =', req.body);
    let uploadFileName = req.body.uploadFileName;
    let sourcePath = null;
    let originalName = null;

    if (req.file) {
      sourcePath = req.file.path;
      originalName = req.file.originalname;
      console.log('POST /generate - uploaded file present:', req.file.filename);
    } else if (uploadFileName) {
      const candidate = path.join(uploadFolder, uploadFileName);
      if (!fs.existsSync(candidate)) {
        console.warn('POST /generate - uploaded file not found on disk:', candidate);
        return res.status(404).json({ error: 'Uploaded file not found. Please re-upload and try again.' });
      }
      sourcePath = candidate;
      originalName = uploadFileName;
    } else {
      console.warn('POST /generate - missing file and uploadFileName');
      return res.status(400).json({ error: 'Missing file or upload identifier.' });
    }

    const metadata = parseFileName(originalName);
    const outputFileName = `${metadata.sheetName.replace(/[^a-zA-Z0-9 \-_]/g, '_')}.xlsx`;
    const outputPath = path.join(generatedFolder, outputFileName);

    console.log('POST /generate - processing started for', sourcePath);
    const generationResult = await processSalesPlanWorkbook({
      sourcePath,
      outputPath,
      sheetName: metadata.sheetName
    });
    console.log('POST /generate - processing completed, result:', generationResult);

    return res.status(200).json({
      message: 'Sales plan workbook generated successfully.',
      generatedFileName: outputFileName,
      sheetName: metadata.sheetName,
      totalRows: generationResult.totalRows,
      totalCustomers: generationResult.totalCustomers,
      summaryRows: generationResult.summaryRows
    });
  } catch (error) {
    console.error('POST /generate - error:', error && error.message ? error.message : error);
    return res.status(500).json({ error: error.message || 'Generation failed.' });
  }
});

router.get('/download', (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Missing download filename.' });
    }
    const filePath = path.join(generatedFolder, path.basename(name));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Generated workbook not found.' });
    }
    return res.download(filePath);
  } catch (error) {
    next(error);
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

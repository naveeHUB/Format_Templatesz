const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const XLSX = require('xlsx');

const templateRoutes = require('./routes/templateRoutes');
const generateRoutes = require('./routes/generateRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// Paths
const uploadFolder = path.join(__dirname, 'uploads');
const templatesFolder = path.join(uploadFolder, 'templates');
const dataFolder = path.join(uploadFolder, 'data');
const outputFolder = path.join(uploadFolder, 'output');

// Ensure folders exist
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}
if (!fs.existsSync(templatesFolder)) {
  fs.mkdirSync(templatesFolder, { recursive: true });
}
if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder, { recursive: true });
}
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(uploadFolder));

// Routes
app.use('/api/templates', templateRoutes);
app.use('/', generateRoutes);

// Demo data pipeline removed

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
// START SERVER (ONLY ONCE)
// ==============================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sales Plan backend running at http://0.0.0.0:${PORT}`);
});
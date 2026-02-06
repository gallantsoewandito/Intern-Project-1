// ai-server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dashscope-Key, X-Gemini-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const upload = multer({ dest: 'temp/' });

// Import your existing logic
const { extractProductFromImageQwen } = require('./src/utils/qwenClient');
const { structureProductDataGemini, extractProductFromImageGemini } = require('./src/utils/geminiClient');
const { addProduct, toCSV, saveToFile, clearProducts, getProductCount } = require('./src/utils/csvManager');


// Process a single image
app.post('/process-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  // 👇 Add this line — critical!
  console.log('[SERVER] 📁 File saved to:', req.file.path);
  console.log('[SERVER] 🧪 Starting AI processing...');

  try {
    console.log(`Processing: ${req.file.originalname}`);
    
    // Step 1: Extract raw text (Qwen-VL)
    const rawText = await extractProductFromImageQwen(req.file.path);
    
    // Step 2: Structure it (Gemini)
    const structured = await structureProductDataGemini(rawText);
    
    // Step 3: Add to CSV manager
    addProduct(structured);
    
    // Clean up temp file
    await fs.unlink(req.file.path).catch(() => {});
    
    res.json({
      success: true,
      product: structured,
      total: getProductCount()
    });
  } catch (err) {
    console.error('AI Error:', err.message);
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Get current CSV content
app.get('/csv', (req, res) => {
  res.set('Content-Type', 'text/csv');
  res.send(toCSV());
});

// Save CSV to disk
app.post('/save-csv', async (req, res) => {
  try {
    const filename = req.query.filename || 'products.csv';
    const csv = toCSV();
    res.json({ success: true, csv }); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const projectRoot = path.resolve(__dirname, 'AI Product Scanner');
app.use(express.static(path.join(projectRoot, 'src')));

// Clear all products
app.post('/clear', (req, res) => {
  clearProducts();
  res.json({ success: true });
});

// Get product count
app.get('/count', (req, res) => {
  res.json({ count: getProductCount() });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0',() => {
  console.log(`✅ AI Server running on http://0.0.0.0:${PORT}`);
});

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});
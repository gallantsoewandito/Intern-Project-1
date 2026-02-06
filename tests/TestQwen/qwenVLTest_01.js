// tests/qwenVLTest_01.js
const { extractProductFromImageQwen } = require('../../src/utils/qwenClient');

(async () => {
  try {
    const imagePath = './data/Clearshampoo.jpeg'; // ← put a real image here
    const rawText = await extractProductFromImageQwen(imagePath);
    console.log('Raw extraction:', rawText);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
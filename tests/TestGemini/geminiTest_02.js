// tests/qwenVLTest_01.js
import { extractProductFromImageGemini } from "../../src/utils/geminiClientBrowser.js";

(async () => {
  try {
    const imagePath = './data/Clearshampoo.jpeg'; // ← put a real image here
    const rawText = await extractProductFromImageGemini(imagePath);
    console.log('Raw extraction:', rawText);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
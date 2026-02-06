// tests/geminiTest_01.js

const { structureProductDataGemini } = require('../../src/utils/geminiClient');

(async () => {
  const raw = "Clear Sampo Anti Ketombe Rp N/A N/A Beauty N/A";
  const structured = await structureProductDataGemini(raw);
  console.log(JSON.stringify(structured, null, 2));
})();
// tests/geminiTest_01.js

const { structureProductDataWithQwen } = require('../../src/utils/qwenClient');

(async () => {
  const raw = "Clear Shampoo Anti Ketombe Perawatan Komplit 0 N/A Hair Care Bottle";
  const structured = await structureProductDataWithQwen(raw);
  console.log(JSON.stringify(structured, null, 2));
})();
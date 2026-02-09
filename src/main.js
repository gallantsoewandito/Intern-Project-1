// src/main.js

import { extractProductFromImageGemini } from "./utils/geminiClientBrowser.js";

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const progressEl = document.getElementById('progress');
  const previewEl = document.getElementById('preview');
  const geminiKeyInput = document.getElementById('geminiKey');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const clearKeyBtn = document.getElementById('clearKeyBtn');

  let processing = false;
  let productsList = [];

  const savedKey = localStorage.getItem('GEMINI_API_KEY');
  if (savedKey && geminiKeyInput) {
      geminiKeyInput.value = '••••••••';
  }

  saveKeyBtn.addEventListener('click', () => {
      const key = geminiKeyInput.value.trim().replace(/['"]+/g, '');;
      if (key && key !== '••••••••') {
        localStorage.setItem('GEMINI_API_KEY', key);
        geminiKeyInput.value = '';
        alert('✅ Gemini API key saved!');
      } else {
        alert('⚠️ Please enter a valid API key.');
      }
    });

  clearKeyBtn.addEventListener('click', () => {
    localStorage.removeItem('GEMINI_API_KEY');
    document.getElementById('geminiKey').value = '';
    alert('✅ API key cleared.');
  });

  function init() {
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    saveBtn.addEventListener('click', downloadCSV);

    clearBtn.addEventListener('click', () => {
      productsList = [];
      updatePreview();
      saveBtn.disabled = true;
    });

    updatePreview();
  }

  async function handleFiles(files) {
    if (processing) return;

    const GEMINI_API_KEY = localStorage.getItem('GEMINI_API_KEY').trim().replace(/['"]+/g, '');;
    if (!GEMINI_API_KEY || GEMINI_API_KEY === '••••••••' || GEMINI_API_KEY.trim() === "") {
      return alert("Set Gemini API Key!");
    }

    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    processing = true;
    updateProgress(`Processing ${fileArray.length} images...`);

    for (let i = 0; i < fileArray.length; i++) {
      try {
        const product = await extractProductFromImageGemini(fileArray[i], GEMINI_API_KEY);
        productsList.push(product);

        updateProgress(`Processed ${i + 1}/${fileArray.length}: ${product.name}`);
        updatePreview();
        saveBtn.disabled = false;
      } catch (err) {
        if (err.message.includes("429")) {
          console.warn("Rate limit hit. Retrying in 2 seconds...");
          await new Promise(resolve => setTimeout(resolve, 2000));
          i--;
          continue;
      }
        console.error(err);
        updateProgress(`❌ Error: ${err.message}`);
      }
    }
    processing = false;
  }

  function updatePreview() {
    if (productsList.length === 0) {
      previewEl.innerHTML = '<p>No products yet.</p>';
      return;
    }
    let html = '';
    productsList.forEach((product, i) => {
      html += `
        <div class="product-card">
          <strong>Processed ${i + 1}/${productsList.length}:</strong>
          <pre class="product-details">${formatProductForDisplay(product)}</pre>
        </div>
      `;
    });
    previewEl.innerHTML = html;
  }

  function downloadCSV() {
    const headers = ["name", "price", "unit", "sku", "category"];
    const csvContent = [
      headers.join(","),
      ...productsList.map(p => headers.map(h => `"${p[h] || ''}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatProductForDisplay(product) {
    return [
      `• Name: ${product.name || '—'}`,
      `• Price: ${product.price && !isNaN(product.price) ? `Rp ${Number(product.price).toLocaleString()}` : '—'}`,
      `• Unit: ${product.unit || '—'}`,
      `• SKU: ${product.sku || '—'}`,
      `• Category: ${product.category || '—'}`
    ].join('\n');
  }

  function updateProgress(text) {
    progressEl.textContent = text;
  }

  init();
});
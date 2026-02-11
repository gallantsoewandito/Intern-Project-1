// src/main.js

import { extractProductFromImageGemini, extractProductFromAudioGemini } from "./utils/geminiClientBrowser.js";

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const micBtn = document.getElementById('micBtn')
  const progressEl = document.getElementById('progress');
  const previewEl = document.getElementById('preview');
  const geminiKeyInput = document.getElementById('geminiKey');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const clearKeyBtn = document.getElementById('clearKeyBtn');

  let processing = false;
  let productsList = [];
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  const savedKey = localStorage.getItem('GEMINI_API_KEY');
  if (savedKey && geminiKeyInput) {
      geminiKeyInput.value = '';
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

  micBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isRecording) {
      await startRecording();
    } else stopRecording();
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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true});
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm'});
        const audioFile = new File([audioBlob], "voice-command.webm", { type: 'audio/webm'});
        handleFiles([audioFile]);
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.textContent = "🛑 Stop & Process";
      micBtn.classList.add('recording-active');
      updateProgress("Listening... Describe the product now.");
    } catch (err) {
      console.error("Mic Error: ", err);
      alert("Could not access microphone. Check permissions.");
    }
  }

  function stopRecording() {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    isRecording = false;
    micBtn.textContent = "🎙️ Open Mic";
    micBtn.classList.remove('recording-active');
  }

  async function handleFiles(files) {
    if (processing) return;

    const rawKey = localStorage.getItem('GEMINI_API_KEY');
    const GEMINI_API_KEY = rawKey ? rawKey.trim().replace(/['"]+/g, '') : '';
    if (!GEMINI_API_KEY || GEMINI_API_KEY === '••••••••' || GEMINI_API_KEY.trim() === "") {
      return alert("Set Gemini API Key!");
    }

    const fileArray = Array.from(files).filter(f => 
      f.type.startsWith('image/') || f.type.startsWith('audio/')
    );
    if (fileArray.length === 0) return;

    processing = true;

    for (let i = 0; i < fileArray.length; i++) {
      const currentFile = fileArray[i];
      updateProgress(((i) / fileArray.length) * 100);
      if (progressEl) {
        progressEl.textContent = `Processing ${i + 1}/${fileArray.length}...`;
      }
      try {
        let product;
        if (currentFile.type.startsWith('image/')) {
          product = await extractProductFromImageGemini(fileArray[i], GEMINI_API_KEY);
        } else {
          product = await extractProductFromAudioGemini(fileArray[i], GEMINI_API_KEY);
        }
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
    updateProgress(100);
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

  function updateProgress(percent) {
    const bar = document.querySelector('.bar');
    if (bar) bar.style.width = `${percent}%`;
  }

  init();
});
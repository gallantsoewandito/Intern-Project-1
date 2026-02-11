// src/utils/geminiClientBrowser.js

//require('dotenv').config();
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai@0.17.0";

async function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Extract the base64 string from the data URL
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function extractProductFromImageGemini(file, geminiKey) {
    if(!geminiKey) {
        throw new Error('Missing GEMINI_API_KEY');
    }

    const GEMINI_API_KEY = geminiKey.trim().replace(/['"]+/g, '');

    const client = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = client.getGenerativeModel(
      { model: "gemini-2.0-flash"},
      { apiVersion: "v1"}
    );

    // Prepare multimodal prompt
    const prompt = `
    Analyze the product image and return a JSON object with these EXACT keys (as an example):
    {
      "name": "Full product name as printed",
      "price": 25000,
      "unit": "Volume or weight (e.g., 180ml, 1kg)",
      "sku": "Barcode or SKU number if visible, otherwise N/A",
      "category": "One of: Beauty, Food, Stationery, Electronics, Home, Other"
    }

    Rules:
    - Return ONLY the JSON object.
    - "price" must be a NUMBER (no "Rp" or dots).
    - "unit" should only contain one unit type, don't mix with other units.
    - If a field is missing, use "N/A".
    - Do not include markdown formatting or backticks.
    `;

    try {
        const imagePart = await fileToGenerativePart(file);
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI failed to return valid JSON");

        const cleanJson = JSON.parse(jsonMatch[0]);

        return {
          name: cleanJson.name || 'N/A',
            price: cleanJson.price || 0,
            unit: cleanJson.unit || 'N/A',
            sku: cleanJson.sku || 'N/A',
            category: cleanJson.category || 'Other'
        };
    } catch (error) {
        console.error('Gemini error:', error);
        return {
            name: "Error: Check Console",
            price: 0,
            unit: "N/A",
            sku: "N/A",
            category: "Error",
            
            isError: true // Optional: helps UI logic identify failures
        };
    }
}

export async function extractProductFromAudioGemini(file, geminiKey) {
  if (!geminiKey) throw new Error('Missing GEMINI_API_KEY');

  const GEMINI_API_KEY = geminiKey.trim().replace(/['"]+/g, '');
  const client = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = client.getGenerativeModel(
    { model: "gemini-2.0-flash"},
    { apiVersion: "v1"}
  )

  const prompt = `
  Listen to this audio carefully. It contains a description of a product.
    Extract the details into this EXACT JSON format:
    {
      "name": "Product name mentioned",
      "price": 0,
      "unit": "Volume/weight mentioned (e.g. 500g)",
      "sku": "SKU or N/A",
      "category": "One of: Beauty, Food, Stationery, Electronics, Home, Other"
    }

    Rules:
    - If the user says "Rupiah", convert it to a plain number for the "price" field.
    - If a field isn't mentioned, use "N/A".
    - Return ONLY raw JSON.
    `;

    try {
      const audioPart = await fileToGenerativePart(file);
      const result = await model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI failed to return valid JSON");

      const cleanJson = JSON.parse(jsonMatch[0]);

      return {
        name: cleanJson.name || 'N/A',
        price: cleanJson.price || 0,
        unit: cleanJson.unit || 'N/A',
        sku: cleanJson.sku || 'N/A',
        category: cleanJson.category || 'Other'
      };
    } catch(error) {
      console.error('Gemini Audio Error: ', error);
      return {
        name: "Audio Scan Error", 
        price: 0, sku: "N/A", 
        category: "Other", 
        unit: "N/A", 
        isError: true
      }
    }
}

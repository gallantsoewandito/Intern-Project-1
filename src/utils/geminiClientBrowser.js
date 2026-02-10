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

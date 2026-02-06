// src/utils/geminiClient.js
require('dotenv').config();
const { GoogleGenAI } = require(`@google/genai`);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY');
}

// FIX: Only provide the apiKey. Do not include project or vertexai settings.
const client = new GoogleGenAI({ 
    apiKey: GEMINI_API_KEY
});

async function structureProductDataGemini(rawText) {
    const prompt = `
You are a product data validator for an Indonesian e-commerce system.
Extract and standardize the following fields from the input:

Input: "${rawText}"

Output strict JSON with these fields:
- "name": product name (string)
- "price (IDR)": price in IDR (number, no commas or "Rp")
- "sku": SKU code (string, uppercase if possible)
- "category": one of ["Beauty", "Food & Beverage", "Stationery", "Electronics", "Home & Living", "Other"]
- "unit": unit/volume/weight (e.g., "180ml", "500g", "1pc")

If a field is missing, use null (N/A).
Do not add extra fields.
`;

    try {
        // Use the standard model naming for the new SDK
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash", 
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                temperature: 0.1 
            }
        });

        // The new @google/genai SDK structure for text
        const text = response.candidates[0].content.parts[0].text; 

        if (!text) {
            throw new Error("Empty response from Gemini");
        }

        return JSON.parse(text);
    } catch (error) {
        console.error('Gemini parsing error: ', error.message);
        return {
            name: rawText,
            price: null,
            sku: null,
            category: "Other",
            unit: null
        };
    }
}

async function extractProductFromImageGemini(imagePath) {
    const fs = require('fs').promises;
    const path = require('path');

    // Read and encode image
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

    // Prepare multimodal prompt
    const prompt = `
    You are a product data extractor for Indonesian e-commerce.
    Analyze this product image and output ONLY ONE LINE with:
    - Product name
    - Price in IDR (e.g., "Rp 25.000")
    - SKU or barcode
    - Category (one word: Beauty, Food, Stationery, Electronics, Home, Other)
    - Unit (e.g., "180ml", "500g", "1pc")

    Format: "Name Price SKU Category Unit"
    Example: "Clear Shampoo Rp 25.000 CLR-SHP-001 Beauty 180ml"

    Do NOT add explanations, markdown, or extra text.
    `;

    try {
        const result = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ 
                role: 'user', 
                parts: [
                    { text: prompt },
                    { inlineData: { data: base64Image, mimeType: mimeType} }
                ] 
            }],
            config: {
                responseMimeType: "application/json",
                temperature: 0.1 
            }
        });

        if (!result || !result.candidates || result.candidates.length === 0) {
            throw new Error("No candidates returned from Gemini. It might be blocked by safety filters.");
        }

        const text = result.text; 

        if (!text) {
            throw new Error("Empty response from Gemini");
        }

        return JSON.parse(text);

    } catch (error) {
        console.error('Gemini image extraction error:', error.message);
        // Fallback: return placeholder
        return `Image analysis failed for ${path.basename(imagePath)}`;
    }
}

module.exports = { structureProductDataGemini, extractProductFromImageGemini};
// src/utils/qwenClient.js

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const VLMAX_API_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

if (!DASHSCOPE_API_KEY) {
    throw new Error('Missing DASHSCOPE_API_KEY in .env');
}

if (process.env.NODE_ENV !== 'production') {
  process.removeAllListeners('warning');
}

async function callQwenWithHistory(messages, model = 'qwen3-max', maxTokens = 250) {
    const formattedMessages = messages.map(msg => {
        if (typeof msg.content === 'string') {
            return {
                role: msg.role,
                content: [{ type: 'text', text: msg.content}]
            };
        }
        return msg;
    });

    const response = await fetch(DASHSCOPE_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages: formattedMessages,
            max_tokens: maxTokens,
            temperature: 0.7
        })
    });

    if(!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Qwen API error: ${response.status} - ${error.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

async function extractProductFromImageQwen(imagePath) {
    const fs = require('fs').promises;
    const path = require('path');

    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

    // Prepare messages for Qwen-VL
    const messages = [{
        role: 'user',
        content: [
            { type: 'image', image: `data:${mimeType};base64,${base64Image}` },
            { type: 'text', text: 'Extract: product name, price (IDR), SKU, category, unit (in grams, ml, etc). Output in one line: "Name Price SKU Category Unit"' }
        ]
    }];

    const response = await fetch(VLMAX_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'qwen-vl-max',
            input: { messages },
            parameters: {
                max_tokens: 300,
                temperature: 0.3
            }
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Qwen-VL API error: ${response.status} - ${error.error?.message || 'Unknown'}`);
    }

    const data = await response.json();

    let extractedText = '';
    try {
        // Path 1: Compatible-mode multimodal (what you got)
        if (data.output?.choices?.[0]?.message?.content?.[0]?.text) {
        extractedText = data.output.choices[0].message.content[0].text;
        }
        // Path 2: Standard chat completion
        else if (data.choices?.[0]?.message?.content) {
        extractedText = data.choices[0].message.content;
        }
        // Fallback
        else {
        throw new Error('No text found in response');
        }
    } catch (e) {
        console.error('Response structure:', JSON.stringify(data, null, 2));
        throw new Error('Failed to extract text: ' + e.message);
    }

    return extractedText.replace(/^"|"$/g, '').trim();
}

async function structureProductDataWithQwen(rawText) {
    const messages = [
        {
            role: 'system',
            content: 'You are a product data validator for an Indonesian e-commerce system.'
            },
            {
            role: 'user',
            content: `
        Extract and standardize the following fields from the input:

        Input: "${rawText}"

        Output strict JSON with these fields:
        - "name": product name (string)
        - "price": price in IDR (number, no commas or "Rp")
        - "sku": SKU code (string, uppercase if possible)
        - "category": one of ["Beauty", "Food & Beverage", "Stationery", "Electronics", "Home & Living", "Other"]
        - "unit": unit/volume/weight (e.g., "180ml", "500g", "1pc")

        If a field is missing, use null.
        Do not add extra fields.
        `
        }
    ];

    try {
        // Use existing callQwenWithHistory (which handles Qwen3-Max)
        const responseText = await callQwenWithHistory(messages, 'qwen3-max', 300);
        
        // Clean potential markdown
        const cleanJson = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

        return JSON.parse(cleanJson);
    } catch (error) {
        console.error('Qwen3-Max parsing error:', error.message);
        return {
        name: rawText,
        price: null,
        sku: null,
        category: "Other",
        unit: null
        };
    }
}

module.exports = { 
    callQwenWithHistory, 
    extractProductFromImageQwen,
    structureProductDataWithQwen
};
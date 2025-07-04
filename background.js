/*
 * background.js - Manifest V3 service worker
 * Receives image+prompt from content script, calls OpenAI Vision API and returns result.
 */

// Store your OpenAI key in chrome.storage (or set it here insecurely for demo).
const OPENAI_MODEL = 'gpt-4.1-2025-04-14'; // example vision-capable model

chrome.runtime.onInstalled.addListener(() => {
  console.log('Easebuzz Auto Captcha Solver installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPENAI_REQUEST') {
    const { imageBase64, prompt } = message.payload;
    (async () => {
      try {
        const apiKey = await getApiKey();
        if (!apiKey) throw new Error('OpenAI API key not set');

        const matches = await queryOpenAi(apiKey, imageBase64, prompt);
        sendResponse({ matches });
      } catch (err) {
        console.error(err);
        sendResponse({ error: err.message });
      }
    })();
    return true; // async
  }
});

async function getApiKey() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['openai_api_key'], (result) => {
      resolve(result.openai_api_key);
    });
  });
}

async function queryOpenAi(apiKey, imageBase64, prompt) {
  const body = {
    model: OPENAI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "captcha_matches",
        schema: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: { type: "integer", minimum: 1, maximum: 9 },
              minItems: 5,
              maxItems: 5
            }
          },
          required: ["matches"],
          additionalProperties: false
        },
        strict: true
      }
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Instruction: "${prompt}". You will be provided an image containing a 3x3 grid numbered 1-9 (row-major). Return a JSON object with exactly one key "matches" whose value is an array of exactly five integers representing the indexes that satisfy the instruction. Respond with ONLY this JSON object and no additional keys or text.` },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      }
    ],
    max_completion_tokens: 20
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error. Status: ${res.status}. Text: ${text}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  let matches;
  try {
    const parsed = JSON.parse(text);
    matches = Array.isArray(parsed) ? parsed : parsed.matches;
    if (!Array.isArray(matches)) throw new Error('Invalid JSON structure');
  } catch (err) {
    throw new Error('Failed to parse OpenAI JSON response');
  }
  
  return matches;
}

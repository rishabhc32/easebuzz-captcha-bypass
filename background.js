/*
 * background.js - Manifest V3 service worker
 * Receives image+prompt from content script, calls OpenAI Vision API and returns result.
 */

// Store your OpenAI key in chrome.storage (or set it here insecurely for demo).
const OPENAI_MODEL = 'gpt-4o-mini'; // example vision-capable model

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
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${prompt}. There are 9 images in a 3x3 grid numbered 1 to 9, return EXACT ARRAY (e.g. [1,3,5,7,9]) of the 5 images that satisfy.` },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      }
    ],
    max_tokens: 20
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  // Extract array of numbers from response
  const matches = JSON.parse(text.match(/\[(.*)\]/)[0]);
  return matches;
}

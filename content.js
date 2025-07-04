/*
 * content.js
 * Runs in the context of https://easebuzz.in/merchant/dashboard.
 * 1. Detect captcha container and click the first button.
 * 2. Wait for canvas to render, convert to image.
 * 3. Extract instruction text.
 * 4. Send both to background for OpenAI vision call.
 * 5. Receive array of indexes to click.
 */

// Util: wait for element helper
function waitForElement(getter, timeout = 10000, interval = 200) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = getter();
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error("Element not found within timeout"));
      }
    }, interval);
  });
}

async function solveCaptcha() {
  try {
    // 1. Find captcha container
    const container = document.querySelector('#captcha-container');
    if (!container) return;

    // 2. Click the first button inside
    const firstButton = container.querySelector('button');
    if (firstButton) firstButton.click();

    // 3. Wait for canvas to render inside container
    const canvas = await waitForElement(() => container.querySelector('canvas'));

    // 4. Convert canvas to data URL (JPEG for size)
    const dataUrl = canvas.toDataURL('image/jpeg');

    // 5. Extract instruction text
    const titleDiv = document.querySelector('div.amzn-captcha-modal-title');
    if (!titleDiv) throw new Error('Title div not found');
    const instructionText = titleDiv.nextElementSibling?.innerText?.trim();

    // 6. Send message to background to query OpenAI
    chrome.runtime.sendMessage({
      type: 'OPENAI_REQUEST',
      payload: {
        imageBase64: dataUrl,
        prompt: instructionText
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message', chrome.runtime.lastError);
        return;
      }
      console.log('OpenAI response', response);
      if (response?.matches) {
        console.log('Matches found', response.matches);
        //highlightMatches(container, response.matches);
      }
    });

  } catch (err) {
    console.error('Captcha solver error', err);
  }
}

// Optionally highlight images for demo / debugging
function highlightMatches(container, indexes) {
  const imgs = [...container.querySelectorAll('img')];
  indexes.forEach(idx => {
    const img = imgs[idx - 1]; // 1-indexed per requirement
    if (img) {
      img.style.outline = '4px solid red';
    }
  });
}

// Run when DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  solveCaptcha();
} else {
  window.addEventListener('DOMContentLoaded', solveCaptcha);
}

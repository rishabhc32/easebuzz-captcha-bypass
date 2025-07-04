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
  // 1. Find captcha container
  const container = document.querySelector('#captcha-container');
  if (!container) throw new Error('Captcha container not found');

  // 2. Click the first button inside
  const firstButton = container.querySelector('button');
  if (!firstButton) throw new Error('Captcha start button not found');
  firstButton.click();

  // 3. Wait for canvas to render inside container
  const canvas = await waitForElement(() => container.querySelector('canvas'));

  // 4. Convert canvas to data URL (JPEG for size)
  const dataUrl = canvas.toDataURL('image/jpeg');

  // 5. Extract instruction text (find div that contains "Choose all ...")
  const instructionDiv = Array.from(container.querySelectorAll('form div'))
    .find(el => /choose all/i.test(el.textContent));
  if (!instructionDiv) throw new Error('Instruction div not found');

  const instructionText = instructionDiv.textContent
    .replace(/\s+/g, ' ')
    .replace(/\d+/g, '')
    .trim();

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

    if (!response?.matches) {
      console.error('No matches found. OpenAI response: ', response);
      return;
    }

    console.log('Matches found', response.matches);
    highlightMatches(container, response.matches);
  });
}

// Click the matched buttons and submit the form
function highlightMatches(container, indexes) {
  // Find the canvas element and its buttons
  const canvas = container.querySelector('canvas');
  if (!canvas) {
    console.error('Canvas not found in container');
    return;
  }

  const buttons = [...canvas.querySelectorAll('button')];
  if (buttons.length === 0) {
    console.error('No buttons found in canvas');
    return;
  }

  console.log(`Found ${buttons.length} buttons, clicking indexes:`, indexes);

  // Click the buttons that match the indexes
  indexes.forEach(idx => {
    const button = buttons[idx - 1]; // 1-indexed per requirement
    button.click();
  });

  // Wait a bit then submit the form
  setTimeout(() => {
    const form = container.closest('form') || document.querySelector('form');
    const submitButton = form?.querySelector('button[type="submit"]');

    if (submitButton) {
      console.log('Submitting form with button:', submitButton);
      submitButton.click();
    } else {
      console.error('Submit button not found');
    }
  }, 1000); // Wait 1 second before submitting
}

// Run after full page load (all resources)
if (document.readyState === 'complete') {
  solveCaptcha();
} else {
  window.addEventListener('load', solveCaptcha);
}

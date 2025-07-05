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

// Add status div to show progress
function addStatusDiv(container) {
  const statusDiv = document.createElement('div');
  statusDiv.id = 'captcha-solver-status';
  statusDiv.style.cssText = `
    background: #f0f8ff;
    border: 1px solid #4CAF50;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #333;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  `;
  statusDiv.textContent = '🤖 Captcha solver ready';
  
  // Insert after captcha container
  container.parentNode.insertBefore(statusDiv, container.nextSibling);
  return statusDiv;
}

// Update status message
function updateStatus(message, type = 'info') {
  const statusDiv = document.getElementById('captcha-solver-status');
  if (!statusDiv) return;
  
  const colors = {
    info: '#4CAF50',
    processing: '#FF9800', 
    error: '#f44336',
    success: '#2196F3'
  };
  
  statusDiv.style.borderColor = colors[type] || colors.info;
  statusDiv.textContent = message;
}

async function solveCaptcha() {
  // 1. Find captcha container
  const container = document.querySelector('#captcha-container');
  if (!container) throw new Error('Captcha container not found');
  
  // Add status div
  const statusDiv = addStatusDiv(container);
  updateStatus('🚀 Starting captcha solve...', 'processing');

  // 2. Click the first button inside
  updateStatus('🔘 Clicking start button...', 'processing');
  const firstButton = container.querySelector('button');
  if (!firstButton) throw new Error('Captcha start button not found');
  firstButton.click();

  // 3. Wait for canvas to render inside container
  updateStatus('⏳ Waiting for captcha to load...', 'processing');
  const canvas = await waitForElement(() => container.querySelector('canvas'));

  // 4. Convert canvas to data URL (JPEG for size)
  updateStatus('📸 Capturing captcha image...', 'processing');
  const dataUrl = canvas.toDataURL('image/jpeg');

  // 5. Extract instruction text (find div that contains "Choose all ...")
  updateStatus('📝 Reading instructions...', 'processing');
  const instructionDiv = Array.from(container.querySelectorAll('form div'))
    .find(el => /choose all/i.test(el.textContent));
  if (!instructionDiv) throw new Error('Instruction div not found');

  const instructionText = instructionDiv.textContent
    .replace(/\s+/g, ' ')
    .replace(/\d+/g, '')
    .trim();

  // 6. Send message to background to query OpenAI
  updateStatus('🧠 Analyzing with OpenAI...', 'processing');
  chrome.runtime.sendMessage({
    type: 'OPENAI_REQUEST',
    payload: {
      imageBase64: dataUrl,
      prompt: instructionText
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message', chrome.runtime.lastError);
      updateStatus('❌ Error: ' + chrome.runtime.lastError.message, 'error');
      return;
    }

    if (!response?.matches) {
      console.error('No matches found. OpenAI response: ', response);
      updateStatus('❌ Error: ' + (response?.error || 'No matches found'), 'error');
      return;
    }

    console.log('Matches found', response.matches);
    updateStatus('🎯 Found matches: ' + response.matches.join(', '), 'success');
    highlightMatches(container, response.matches);
  });
}

// Click the matched buttons and submit the form
function highlightMatches(container, indexes) {
  // Find the canvas element and its buttons
  const canvas = container.querySelector('canvas');
  if (!canvas) {
    console.error('Canvas not found in container');
    updateStatus('❌ Error: Canvas not found', 'error');
    return;
  }

  const buttons = [...canvas.querySelectorAll('button')];
  if (buttons.length === 0) {
    console.error('No buttons found in canvas');
    updateStatus('❌ Error: No buttons found', 'error');
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
    updateStatus('📤 Submitting captcha...', 'processing');
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

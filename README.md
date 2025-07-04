# Easebuzz Auto Captcha Solver Chrome Extension

This Chrome extension automatically solves the image–selection captcha that appears on the Easebuzz Merchant Dashboard.

## How it works
1. Runs only on `https://easebuzz.in/merchant/dashboard`.
2. Clicks the captcha **START** button inside `#captcha-container`.
3. Waits for the 3×3 image grid (rendered as a `<canvas>`).
4. Captures the canvas as a base-64 image, reads the instruction text (e.g. *Choose all the curtains*).
5. Sends both to OpenAI Vision to receive an array of the 5 grid indices (1–9) that match the instruction.
6. Automatically clicks the matched buttons and submits the form to solve the captcha.

## Installation / Usage
1. Clone or download this folder.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select this directory.
3. Click the extension icon → **Options** to store your OpenAI API key.
4. Visit `https://easebuzz.in/merchant/dashboard` and trigger the captcha.

## Security notes
Your OpenAI key is stored locally via `chrome.storage.local` and is never injected into page context.

## Customising
* Switch models in `background.js` (`OPENAI_MODEL`) if required.

// options.js – handles saving the OpenAI API key without inline JS (CSP-safe)

const keyInput = document.getElementById('key');
const status = document.getElementById('status');

// Save key
document.getElementById('save').addEventListener('click', () => {
  const key = keyInput.value.trim();
  chrome.storage.sync.set({ openai_api_key: key }, () => {
    status.textContent = 'Saved!';
    setTimeout(() => {
      status.textContent = '';
      keyInput.value = '';
    }, 2000);
  });
});

'use strict';

// Initialize button state
async function initializeButton() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    chrome.tabs.sendMessage(tab.id, { action: 'getState' }, response => {
      if (!chrome.runtime.lastError && response) {
        updateButtonState(response.active);
      }
    });
  } catch (error) {
    console.error('Error initializing button:', error);
  }
}

function updateButtonState(isActive) {
  const button = document.getElementById('toggleBtn');
  button.textContent = isActive ? 'Video Removal Active' : 'Enable Video Removal';
  button.classList.toggle('active', isActive);
}

document.getElementById('toggleBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    chrome.tabs.sendMessage(tab.id, { action: 'toggleVideoRemoval' }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
      } else {
        updateButtonState(response.active);
      }
    });
  } catch (error) {
    console.error('Detailed error:', error);
  }
});

// Initialize button state when popup opens
document.addEventListener('DOMContentLoaded', initializeButton); 
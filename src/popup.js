'use strict';

// Initialize button states
async function initializeButtons() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    chrome.tabs.sendMessage(tab.id, { action: 'getState' }, response => {
      if (!chrome.runtime.lastError && response) {
        updateButtonState('toggleBtn', response.videoActive);
        updateButtonState('togglePoliticalBtn', response.politicalActive);
      }
    });

    // Load API key if exists
    chrome.storage.local.get(['openaiKey'], function(result) {
      if (result.openaiKey) {
        document.getElementById('apiKeyInput').value = '********';
      }
    });
  } catch (error) {
    console.error('Error initializing buttons:', error);
  }
}

function updateButtonState(buttonId, isActive) {
  const button = document.getElementById(buttonId);
  if (buttonId === 'toggleBtn') {
    button.textContent = isActive ? 'Video Removal Active' : 'Enable Video Removal';
  } else if (buttonId === 'togglePoliticalBtn') {
    button.textContent = isActive ? 'Political Filter Active' : 'Enable Political Filter';
  }
  button.classList.toggle('active', isActive);
}

// Save API Key
document.getElementById('saveApiKey').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKeyInput').value;
  if (apiKey && apiKey !== '********') {
    chrome.storage.local.set({ openaiKey: apiKey }, function() {
      document.getElementById('apiKeyInput').value = '********';
    });
  }
});

// Video filter toggle
document.getElementById('toggleBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    
    chrome.tabs.sendMessage(tab.id, { action: 'toggleVideoRemoval' }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      } else {
        updateButtonState('toggleBtn', response.active);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

// Political filter toggle
document.getElementById('togglePoliticalBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    
    chrome.tabs.sendMessage(tab.id, { action: 'togglePoliticalFilter' }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      } else {
        updateButtonState('togglePoliticalBtn', response.active);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initializeButtons); 
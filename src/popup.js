function updateButtonState(buttonId, isActive) {
  const button = document.getElementById(buttonId);
  button.textContent = isActive ? 'On' : 'Off';
  button.classList.toggle('active', isActive);
  
  // Update button style
  if (isActive) {
    button.style.backgroundColor = '#555';
    button.style.color = '#fff';
  } else {
    button.style.backgroundColor = '#e0e0e0';
    button.style.color = '#333';
  }
}

async function initializeButtons() {
  try {
    // First try to get states from storage directly
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['videoFilterActive', 'customFilterActive', 'adFilterActive', 'customFilterPrompt'], resolve);
    });
    
    // Update buttons based on stored values
    if (result.videoFilterActive !== undefined) {
      updateButtonState('toggleBtn', result.videoFilterActive);
    }
    
    if (result.customFilterActive !== undefined) {
      updateButtonState('toggleCustomBtn', result.customFilterActive);
    }
    
    if (result.adFilterActive !== undefined) {
      updateButtonState('toggleAdBtn', result.adFilterActive);
    }
    
    // Load custom filter prompt if exists
    if (result.customFilterPrompt) {
      document.getElementById('customFilterPrompt').value = result.customFilterPrompt;
    }
    
    // Then try to get states from content script (which may be more up-to-date)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'getState' }, response => {
        if (!chrome.runtime.lastError && response) {
          updateButtonState('toggleBtn', response.videoActive);
          updateButtonState('toggleCustomBtn', response.customActive);
          if (response.adActive !== undefined) {
            updateButtonState('toggleAdBtn', response.adActive);
          }
        }
      });
      
      // Get custom filter prompt from content script
      chrome.tabs.sendMessage(tab.id, { action: 'getCustomFilterPrompt' }, response => {
        if (!chrome.runtime.lastError && response && response.prompt) {
          document.getElementById('customFilterPrompt').value = response.prompt;
        }
      });
    }
    
    // Load API key if exists
    chrome.storage.local.get(['openaiKey'], function(result) {
      if (result.openaiKey) {
        console.log(result.openaiKey);
        document.getElementById('apiKeyInput').value = '********';
      }
    });
  } catch (error) {
    console.error('Error initializing buttons:', error);
  }
}

// Save API Key
document.getElementById('saveApiKey').addEventListener('click', function() {
  const apiKey = document.getElementById('apiKeyInput').value;
  if (apiKey && apiKey !== '********') {
    chrome.storage.local.set({ openaiKey: apiKey }, function() {
      document.getElementById('apiKeyInput').value = '********';
    });
  }
});

// Save Custom Filter Prompt
document.getElementById('saveCustomPrompt').addEventListener('click', async function() {
  const prompt = document.getElementById('customFilterPrompt').value;
  if (prompt) {
    // Save to storage
    chrome.storage.local.set({ customFilterPrompt: prompt });
    
    // Send to content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'updateCustomFilterPrompt', 
          prompt: prompt 
        });
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
    }
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

// Custom filter toggle
document.getElementById('toggleCustomBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    
    chrome.tabs.sendMessage(tab.id, { action: 'toggleCustomFilter' }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      } else {
        updateButtonState('toggleCustomBtn', response.active);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

// Ad filter toggle
document.getElementById('toggleAdBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    
    chrome.tabs.sendMessage(tab.id, { action: 'toggleAdFilter' }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      } else {
        updateButtonState('toggleAdBtn', response.active);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initializeButtons);
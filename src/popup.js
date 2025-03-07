'use strict';

// Initialize button states
function initializeButtons() {
  return _initializeButtons.apply(this, arguments);
}

function _initializeButtons() {
  _initializeButtons = _asyncToGenerator(/*#__PURE__*/_regeneratorRuntime().mark(function _callee3() {
    var _yield$chrome$tabs$qu5, _yield$chrome$tabs$qu6, tab;
    return _regeneratorRuntime().wrap(function _callee3$(_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return chrome.tabs.query({
            active: true,
            currentWindow: true
          });
        case 2:
          _yield$chrome$tabs$qu5 = _context3.sent;
          _yield$chrome$tabs$qu6 = _slicedToArray(_yield$chrome$tabs$qu5, 1);
          tab = _yield$chrome$tabs$qu6[0];
          if (tab) {
            _context3.next = 7;
            break;
          }
          return _context3.abrupt("return");
        case 7:
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'getState'
            }, function (response) {
              if (!chrome.runtime.lastError && response) {
                updateButtonState('toggleBtn', response.videoActive);
                updateButtonState('togglePoliticalBtn', response.politicalActive);
              }
            });

            // Load API key if exists
            chrome.storage.local.get(['openaiKey'], function (result) {
              if (result.openaiKey) {
                document.getElementById('apiKeyInput').value = '********';
              }
            });
          } catch (error) {
            console.error('Error initializing buttons:', error);
          }
        case 8:
        case "end":
          return _context3.stop();
      }
    }, _callee3);
  }));
  return _initializeButtons.apply(this, arguments);
}

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
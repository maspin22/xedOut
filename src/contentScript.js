'use strict';

let isVideoRemovalActive = false;
let isPoliticalFilterActive = false;
let observer = null;
let politicalFilteredPosts = 0; // Counter for political filtered posts
let videoFilteredPosts = 0; // Counter for video filtered posts
let processedPosts = new Set(); // Track processed post IDs
let processingInProgress = false; // Flag to prevent concurrent processing
let debugPanelVisible = false; // Control debug panel visibility

async function analyzePoliticalContent(text) {
  try {
    const apiKey = await new Promise((resolve) => {
      chrome.storage.local.get(['openaiKey'], function(result) {
        resolve(result.openaiKey);
      });
    });

    if (!apiKey) {
      console.log('[X Filter] No API key found');
      return false;
    }

    const prompt = `Analyze if the following content is political in nature. Respond with only "true" or "false":
    "${text}"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: prompt
        }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const result = data.choices[0].message.content.toLowerCase().trim();
    return result === 'true';
  } catch (error) {
    console.error('[X Filter] Error analyzing content:', error);
    return false;
  }
}

/**
 * Searches for video elements within the page.
 * When found inside a post container, the post is hidden.
 */
function hideVideoPosts() {
  // Look for video elements
  const videoElements = document.querySelectorAll('video');

  videoElements.forEach(videoElement => {
    // Assume that the post is housed in an <article> element
    const postContainer = videoElement.closest('article');
    if (postContainer) {
      // Get a unique identifier for the post
      const postId = getPostId(postContainer);
      
      // Skip if already processed
      if (processedPosts.has(postId)) return;
      
      // Mark as processed
      processedPosts.add(postId);
      
      // Hide the post
      postContainer.style.display = 'none';
      videoFilteredPosts++; // Increment video filtered count
      console.log('[X Filter] Hiding post with video');
      
      // Update debug panel if visible
      if (debugPanelVisible) {
        updateDebugPanel();
      }
    }
  });
}

// Get a unique identifier for a post
function getPostId(postElement) {
  // Try to get the post ID from data attributes
  const idAttribute = postElement.getAttribute('data-testid') || '';
  const articleId = postElement.getAttribute('aria-labelledby') || '';
  
  // If we have an ID attribute, use it
  if (idAttribute || articleId) {
    return `${idAttribute}-${articleId}`;
  }
  
  // Fallback to using the post's content as an ID
  const textContent = postElement.textContent.substring(0, 100);
  return textContent.replace(/\s+/g, '');
}

async function processPoliticalPosts() {
  // Find all posts (articles) on the page
  const posts = document.querySelectorAll('article');
  
  // Process each post for political content
  for (const post of posts) {
    // Get a unique identifier for the post
    const postId = getPostId(post);
    
    // Skip posts we've already processed
    if (processedPosts.has(postId)) {
      continue;
    }
    
    // Get the text content of the post
    const textContent = post.textContent;
    
    // Skip very short posts
    if (textContent.length < 10) {
      continue;
    }
    
    // Mark as processed before analysis to prevent duplicate processing
    processedPosts.add(postId);
    
    const isPolitical = await analyzePoliticalContent(textContent);
    
    if (isPolitical) {
      politicalFilteredPosts++; // Increment political filtered count
      // Hide the post
      post.style.display = 'none';
      console.log('[X Filter] Hiding political post');
      
      // Update debug panel if visible
      if (debugPanelVisible) {
        updateDebugPanel();
      }
    }
  }
}

/**
 * Process all posts on the page based on active filters
 */
async function processAllPosts() {
  // Prevent concurrent processing
  if (processingInProgress) return;
  processingInProgress = true;
  
  try {
    if (isVideoRemovalActive) {
      hideVideoPosts();
    }
    
    if (isPoliticalFilterActive) {
      await processPoliticalPosts();
    }
    
    // Update debug panel if visible
    if (debugPanelVisible) {
      updateDebugPanel();
    }
  } finally {
    processingInProgress = false;
  }
}

/**
 * Starts the content filtering functionality.
 */
function startObserver() {
  // Initial processing
  processAllPosts();

  // Set up a MutationObserver to watch for new posts being loaded dynamically.
  if (!observer) {
    observer = new MutationObserver((mutations) => {
      // Throttle processing to reduce performance impact
      if (!processingInProgress) {
        setTimeout(() => {
          processAllPosts();
        }, 1000);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[X Filter] Observer started');
  }
}

/**
 * Stops the active filtering functionality.
 */
function stopObserver() {
  // Stop the MutationObserver if active
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log('[X Filter] Observer stopped');
  }
}

// Add a debug panel to the page
function addDebugPanel() {
  // Create a toggle button instead of always showing the panel
  const toggleButton = document.createElement('button');
  toggleButton.id = 'x-filter-debug-toggle';
  toggleButton.textContent = 'X Filter';
  toggleButton.style.position = 'fixed';
  toggleButton.style.bottom = '10px';
  toggleButton.style.right = '10px';
  toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  toggleButton.style.color = 'white';
  toggleButton.style.padding = '5px 10px';
  toggleButton.style.borderRadius = '5px';
  toggleButton.style.zIndex = '9999';
  toggleButton.style.fontSize = '12px';
  toggleButton.style.border = 'none';
  toggleButton.style.cursor = 'pointer';
  
  document.body.appendChild(toggleButton);
  
  // Create the debug panel (hidden by default)
  const panel = document.createElement('div');
  panel.id = 'x-filter-debug-panel';
  panel.style.position = 'fixed';
  panel.style.bottom = '45px';
  panel.style.right = '10px';
  panel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  panel.style.color = 'white';
  panel.style.padding = '10px';
  panel.style.borderRadius = '5px';
  panel.style.zIndex = '9999';
  panel.style.fontSize = '12px';
  panel.style.maxWidth = '300px';
  panel.style.display = 'none';
  
  panel.innerHTML = `
    <h3 style="margin: 0 0 5px 0;">X Filter Debug</h3>
    <div id="x-filter-debug-content">
      <p>Video Filter: <span id="video-filter-status">Inactive</span></p>
      <p>Political Filter: <span id="political-filter-status">Inactive</span></p>
      <p>Videos Filtered: <span id="video-filtered-count">0</span></p>
      <p>Political Posts Filtered: <span id="political-filtered-count">0</span></p>
      <p>Total Posts Filtered: <span id="total-filtered-count">0</span></p>
    </div>
  `;
  
  document.body.appendChild(panel);
  
  // Toggle debug panel when button is clicked
  toggleButton.addEventListener('click', () => {
    debugPanelVisible = !debugPanelVisible;
    panel.style.display = debugPanelVisible ? 'block' : 'none';
    
    // Update panel if it's now visible
    if (debugPanelVisible) {
      updateDebugPanel();
    }
  });
}

// Update the debug panel with current stats
function updateDebugPanel() {
  const videoStatus = document.getElementById('video-filter-status');
  const politicalStatus = document.getElementById('political-filter-status');
  const videoCount = document.getElementById('video-filtered-count');
  const politicalCount = document.getElementById('political-filtered-count');
  const totalCount = document.getElementById('total-filtered-count');
  
  if (videoStatus) videoStatus.textContent = isVideoRemovalActive ? 'Active' : 'Inactive';
  if (politicalStatus) politicalStatus.textContent = isPoliticalFilterActive ? 'Active' : 'Inactive';
  if (videoCount) videoCount.textContent = videoFilteredPosts;
  if (politicalCount) politicalCount.textContent = politicalFilteredPosts;
  if (totalCount) totalCount.textContent = videoFilteredPosts + politicalFilteredPosts;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    sendResponse({ 
      videoActive: isVideoRemovalActive,
      politicalActive: isPoliticalFilterActive
    });
  } else if (request.action === 'toggleVideoRemoval') {
    isVideoRemovalActive = !isVideoRemovalActive;
    console.log(`[X Filter] Video removal ${isVideoRemovalActive ? 'enabled' : 'disabled'}`);
    
    // Start or stop the observer based on whether any filter is active
    if (isVideoRemovalActive || isPoliticalFilterActive) {
      startObserver();
    } else {
      stopObserver();
    }
    
    // Update debug panel if visible
    if (debugPanelVisible) {
      updateDebugPanel();
    }
    
    sendResponse({ success: true, active: isVideoRemovalActive });
  } else if (request.action === 'togglePoliticalFilter') {
    isPoliticalFilterActive = !isPoliticalFilterActive;
    console.log(`[X Filter] Political filter ${isPoliticalFilterActive ? 'enabled' : 'disabled'}`);
    
    // Start or stop the observer based on whether any filter is active
    if (isVideoRemovalActive || isPoliticalFilterActive) {
      startObserver();
    } else {
      stopObserver();
    }
    
    // Update debug panel if visible
    if (debugPanelVisible) {
      updateDebugPanel();
    }
    
    sendResponse({ success: true, active: isPoliticalFilterActive });
  }
  
  return true; // Indicates async response
});

// Initial setup when the script loads
console.log('[X Content Filter] Content script loaded');
addDebugPanel();

// Process posts on initial load with a small delay
setTimeout(() => {
  processAllPosts();
}, 2000); 
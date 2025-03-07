'use strict';

let isVideoRemovalActive = false;
let isPoliticalFilterActive = false;
let observer = null;
let videoFilteredPosts = 0;
let politicalFilteredPosts = 0;
let processedPosts = new Set(); // Track processed post IDs
let processingInProgress = false; // Flag to prevent concurrent processing

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
      videoFilteredPosts++;
      console.log('[X Filter] Hiding post with video');
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
      politicalFilteredPosts++;
      // Hide the post
      post.style.display = 'none';
      console.log('[X Filter] Hiding political post', textContent);
      
    }
  }
}

// Process all posts (both video and political)
async function processAllPosts() {
  if (processingInProgress) return;
  processingInProgress = true;
  
  try {
    // Process video posts if that filter is active
    if (isVideoRemovalActive) {
      hideVideoPosts();
    }
    
    // Process political posts if that filter is active
    if (isPoliticalFilterActive) {
      await processPoliticalPosts();
    }
  } catch (error) {
    console.error('[X Filter] Error processing posts:', error);
  } finally {
    processingInProgress = false;
  }
}

// Start observing the DOM for changes
function startObserver() {
  if (observer) return; // Observer already running
  
  console.log('[X Filter] Starting observer');
  
  observer = new MutationObserver((mutations) => {
    // Use a small delay to allow the DOM to settle
    clearTimeout(window.processingTimeout);
    window.processingTimeout = setTimeout(() => {
      processAllPosts();
    }, 500);
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Initial processing
  processAllPosts();
}

// Stop the observer
function stopObserver() {
  // Stop the MutationObserver if active
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log('[X Filter] Observer stopped');
  }
}

// Toggle video filter
function toggleVideoFilter() {
  isVideoRemovalActive = !isVideoRemovalActive;
  console.log(`[X Filter] Video removal ${isVideoRemovalActive ? 'enabled' : 'disabled'}`);
  
  // Start or stop the observer based on whether any filter is active
  if (isVideoRemovalActive || isPoliticalFilterActive) {
    startObserver();
  } else {
    stopObserver();
  }
  
  // Sync state with extension storage
  chrome.storage.local.set({ videoFilterActive: isVideoRemovalActive });
}

// Toggle political filter
function togglePoliticalFilter() {
  isPoliticalFilterActive = !isPoliticalFilterActive;
  console.log(`[X Filter] Political filter ${isPoliticalFilterActive ? 'enabled' : 'disabled'}`);
  
  // Start or stop the observer based on whether any filter is active
  if (isVideoRemovalActive || isPoliticalFilterActive) {
    startObserver();
  } else {
    stopObserver();
  }
  
  // Sync state with extension storage
  chrome.storage.local.set({ politicalFilterActive: isPoliticalFilterActive });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    sendResponse({ 
      videoActive: isVideoRemovalActive,
      politicalActive: isPoliticalFilterActive
    });
  } else if (request.action === 'toggleVideoRemoval') {
    toggleVideoFilter();
    sendResponse({ success: true, active: isVideoRemovalActive });
  } else if (request.action === 'togglePoliticalFilter') {
    togglePoliticalFilter();
    sendResponse({ success: true, active: isPoliticalFilterActive });
  }
  
  return true; // Indicates async response
});

// Load saved filter states
function loadSavedFilterStates() {
  chrome.storage.local.get(['videoFilterActive', 'politicalFilterActive'], function(result) {
    if (result.videoFilterActive !== undefined) {
      isVideoRemovalActive = result.videoFilterActive;
    }
    
    if (result.politicalFilterActive !== undefined) {
      isPoliticalFilterActive = result.politicalFilterActive;
    }
    
    // Start observer if any filter is active
    if (isVideoRemovalActive || isPoliticalFilterActive) {
      startObserver();
    }
    
    console.log(`[X Filter] Loaded saved states - Video: ${isVideoRemovalActive}, Political: ${isPoliticalFilterActive}`);
  });
}

// Initial setup when the script loads
console.log('[X Content Filter] Content script loaded');
loadSavedFilterStates();

// Process posts on initial load with a small delay
setTimeout(() => {
  processAllPosts();
}, 2000); 
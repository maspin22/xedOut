'use strict';

let isVideoRemovalActive = false;
let isCustomFilterActive = false;
let isAdFilterActive = false;
let observer = null;
let videoFilteredPosts = 0;
let customFilteredPosts = 0;
let adFilteredPosts = 0;
let processedPosts = new Set(); // Track processed post IDs
let processingInProgress = false; // Flag to prevent concurrent processing
let customFilterPrompt = "Analyze if the following content is political in nature."; // Default prompt

async function analyzeCustomContent(text, imageUrls = []) {
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

    // Get the custom filter prompt
    const savedPrompt = await new Promise((resolve) => {
      chrome.storage.local.get(['customFilterPrompt'], function(result) {
        resolve(result.customFilterPrompt || customFilterPrompt);
      });
    });
    
    // Create a prompt that includes both text and image descriptions
    let prompt = `${savedPrompt} Respond with only "true" or "false":\n`;
    
    // Add the text content
    prompt += `Post text: "${text}"\n`;
    
    // Add image descriptions if available
    if (imageUrls.length > 0) {
      prompt += `The post contains ${imageUrls.length} image(s). Please consider the images in your analysis.`;
    }

    // Prepare messages array with text content
    const messages = [{
      role: "user",
      content: prompt
    }];

    // Add image content if available
    if (imageUrls.length > 0) {
      // For GPT-4o, we can include image URLs directly in the content array
      const contentArray = [
        {
          type: "text",
          text: prompt
        }
      ];
      
      // Add each image to the content array
      for (const imageUrl of imageUrls.slice(0, 2)) { // Limit to 2 images to avoid token limits
        contentArray.push({
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        });
      }
      
      // Replace the simple text message with the content array
      messages[0].content = contentArray;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('[X Filter] API Error:', data.error);
      return false;
    }
    
    const result = data.choices[0].message.content.toLowerCase().trim();
    return result === 'true';
  } catch (error) {
    console.error('[X Filter] Error analyzing content:', error);
    return false;
  }
}

/**
 * Extract image URLs from a post element
 */
function extractImageUrls(postElement) {
  const imageUrls = [];
  
  // Find all images in the post
  const images = postElement.querySelectorAll('img');
  
  images.forEach(img => {
    // Skip tiny images, profile pictures, and icons
    if (img.width < 100 || img.height < 100) return;
    
    // Skip images with certain class names that indicate they're not content
    const className = img.className || '';
    if (className.includes('profile') || className.includes('avatar') || className.includes('icon')) return;
    
    // Get the image URL
    const src = img.src;
    if (src && !src.includes('data:image')) { // Skip data URLs
      imageUrls.push(src);
    }
  });
  
  return imageUrls;
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

/**
 * Searches for advertisements on the page and hides them.
 */
function hideAds() {
  // Look for promoted posts (ads)
  // X/Twitter marks ads with specific text or attributes
  
  // Method 1: Look for "Promoted" text in spans
  const promotedTexts = Array.from(document.querySelectorAll('span')).filter(span => 
    span.textContent.includes('Promoted') || 
    span.textContent.includes('Ad')
  );
  
  promotedTexts.forEach(promotedSpan => {
    // Find the containing article
    const postContainer = promotedSpan.closest('article');
    if (postContainer) {
      // Get a unique identifier for the post
      const postId = getPostId(postContainer);
      
      // Skip if already processed
      if (processedPosts.has(postId)) return;
      
      // Mark as processed
      processedPosts.add(postId);
      
      // Hide the post
      postContainer.style.display = 'none';
      adFilteredPosts++;
      console.log('[X Filter] Hiding advertisement');
    }
  });
  
  // Method 2: Look for data attributes that might indicate ads
  const possibleAdElements = document.querySelectorAll('[data-testid="promotedIndicator"]');
  possibleAdElements.forEach(adElement => {
    const postContainer = adElement.closest('article');
    if (postContainer) {
      // Get a unique identifier for the post
      const postId = getPostId(postContainer);
      
      // Skip if already processed
      if (processedPosts.has(postId)) return;
      
      // Mark as processed
      processedPosts.add(postId);
      
      // Hide the post
      postContainer.style.display = 'none';
      adFilteredPosts++;
      console.log('[X Filter] Hiding advertisement (data attribute)');
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

async function processCustomPosts() {
  // Find all posts (articles) on the page
  const posts = document.querySelectorAll('article');
  
  // Process each post for custom content
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
    
    // Extract image URLs from the post
    const imageUrls = extractImageUrls(post);
    
    // Mark as processed before analysis to prevent duplicate processing
    processedPosts.add(postId);
    
    // Analyze the post content including any images
    const shouldFilter = await analyzeCustomContent(textContent, imageUrls);
    
    if (shouldFilter) {
      customFilteredPosts++;
      // Hide the post
      post.style.display = 'none';
      console.log('[X Filter] Hiding custom filtered post', imageUrls.length > 0 ? '(with images)' : '');
    }
  }
}

// Process all posts (video, custom, and ads)
async function processAllPosts() {
  if (processingInProgress) return;
  processingInProgress = true;
  
  try {
    // Process video posts if that filter is active
    if (isVideoRemovalActive) {
      hideVideoPosts();
    }
    
    // Process ads if that filter is active
    if (isAdFilterActive) {
      hideAds();
    }
    
    // Process custom posts if that filter is active
    if (isCustomFilterActive) {
      await processCustomPosts();
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
  if (isVideoRemovalActive || isCustomFilterActive || isAdFilterActive) {
    startObserver();
  } else {
    stopObserver();
  }
  
  // Sync state with extension storage
  chrome.storage.local.set({ videoFilterActive: isVideoRemovalActive });
}

// Toggle custom filter
function toggleCustomFilter() {
  isCustomFilterActive = !isCustomFilterActive;
  console.log(`[X Filter] Custom filter ${isCustomFilterActive ? 'enabled' : 'disabled'}`);
  
  // Start or stop the observer based on whether any filter is active
  if (isVideoRemovalActive || isCustomFilterActive || isAdFilterActive) {
    startObserver();
  } else {
    stopObserver();
  }
  
  // Sync state with extension storage
  chrome.storage.local.set({ customFilterActive: isCustomFilterActive });
}

// Toggle ad filter
function toggleAdFilter() {
  isAdFilterActive = !isAdFilterActive;
  console.log(`[X Filter] Ad filter ${isAdFilterActive ? 'enabled' : 'disabled'}`);
  
  // Start or stop the observer based on whether any filter is active
  if (isVideoRemovalActive || isCustomFilterActive || isAdFilterActive) {
    startObserver();
  } else {
    stopObserver();
  }
  
  // Sync state with extension storage
  chrome.storage.local.set({ adFilterActive: isAdFilterActive });
}

// Update custom filter prompt
function updateCustomFilterPrompt(newPrompt) {
  customFilterPrompt = newPrompt;
  console.log(`[X Filter] Custom filter prompt updated`);
  
  // Sync prompt with extension storage
  chrome.storage.local.set({ customFilterPrompt: newPrompt });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    sendResponse({ 
      videoActive: isVideoRemovalActive,
      customActive: isCustomFilterActive,
      adActive: isAdFilterActive
    });
  } else if (request.action === 'toggleVideoRemoval') {
    toggleVideoFilter();
    sendResponse({ success: true, active: isVideoRemovalActive });
  } else if (request.action === 'toggleCustomFilter') {
    toggleCustomFilter();
    sendResponse({ success: true, active: isCustomFilterActive });
  } else if (request.action === 'toggleAdFilter') {
    toggleAdFilter();
    sendResponse({ success: true, active: isAdFilterActive });
  } else if (request.action === 'updateCustomFilterPrompt') {
    updateCustomFilterPrompt(request.prompt);
    sendResponse({ success: true });
  } else if (request.action === 'getCustomFilterPrompt') {
    sendResponse({ prompt: customFilterPrompt });
  }
  
  return true; // Indicates async response
});

// Load saved filter states and prompt
function loadSavedFilterStates() {
  chrome.storage.local.get(['videoFilterActive', 'customFilterActive', 'adFilterActive', 'customFilterPrompt'], function(result) {
    if (result.videoFilterActive !== undefined) {
      isVideoRemovalActive = result.videoFilterActive;
    }
    
    if (result.customFilterActive !== undefined) {
      isCustomFilterActive = result.customFilterActive;
    }
    
    if (result.adFilterActive !== undefined) {
      isAdFilterActive = result.adFilterActive;
    }
    
    if (result.customFilterPrompt) {
      customFilterPrompt = result.customFilterPrompt;
    }
    
    // Start observer if any filter is active
    if (isVideoRemovalActive || isCustomFilterActive || isAdFilterActive) {
      startObserver();
    }
    
    console.log(`[X Filter] Loaded saved states - Video: ${isVideoRemovalActive}, Custom: ${isCustomFilterActive}, Ads: ${isAdFilterActive}`);
  });
}

// Initial setup when the script loads
console.log('[X Content Filter] Content script loaded');
loadSavedFilterStates();

// Process posts on initial load with a small delay
setTimeout(() => {
  processAllPosts();
}, 2000); 
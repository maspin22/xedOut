'use strict';

let isRemovalActive = false;
let observer = null;

/**
 * Searches for video elements within the page.
 * When found inside a post container, the post is hidden instead of being removed.
 */
function hideVideoPosts() {
  // Look for video elements (this selector can be extended to capture more cases)
  const videoElements = document.querySelectorAll('video');

  videoElements.forEach(videoElement => {
    // Assume that the post is housed in an <article> element (adjust if necessary)
    const postContainer = videoElement.closest('article');
    if (postContainer) {
      console.log('[X Video Remover] Hiding post with video');
      postContainer.style.display = 'none';
    }
  });
}

/**
 * Activates the video removal functionality.
 * Adds a banner and starts observing the DOM for dynamically loaded content.
 */
function startVideoRemoval() {
  // Initial hiding of video posts.
  hideVideoPosts();

  // Set up a MutationObserver to watch for new posts being loaded dynamically.
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        hideVideoPosts();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Stops the active video removal functionality.
 * Removes the banner and disconnects the MutationObserver.
 */
function stopVideoRemoval() {
  // Stop the MutationObserver if active
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Listen for messages from the popup to toggle video removal mode.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    sendResponse({ active: isRemovalActive });
  } else if (request.action === 'toggleVideoRemoval') {
    isRemovalActive = !isRemovalActive;
    
    if (isRemovalActive) {
      startVideoRemoval();
    } else {
      stopVideoRemoval();
    }
    
    sendResponse({ success: true, active: isRemovalActive });
  }
  
  return true;
});

console.log('[X Video Remover] Content script loaded.'); 
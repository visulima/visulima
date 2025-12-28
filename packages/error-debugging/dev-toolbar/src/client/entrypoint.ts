/**
 * Client-side entrypoint for dev toolbar
 * This is injected into the page by the Vite plugin
 * 
 * The toolbar/index.ts file registers the custom element when imported
 */

// Import toolbar to register the custom element
import '../toolbar/index.js';

/**
 * Initialize the dev toolbar when DOM is ready
 */
const initToolbar = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  // Check if already initialized
  if (window.__VISULIMA_DEVTOOLS_INITIALIZED__) {
    return;
  }

  // Create toolbar element (custom element is now registered)
  const toolbar = document.createElement('dev-toolbar') as any;

  // Append to body
  document.body.appendChild(toolbar);

  // Initialize
  if (toolbar.init) {
    toolbar.init();
  }

  // Mark as initialized
  window.__VISULIMA_DEVTOOLS_INITIALIZED__ = true;
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToolbar);
} else {
  initToolbar();
}

// Also listen for HMR init event
if (import.meta.hot) {
  import.meta.hot.on('dev-toolbar:init', () => {
    initToolbar();
  });
}

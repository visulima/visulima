/**
 * Dev toolbar overlay loader
 * This file is loaded via virtual module and injects the toolbar into the page
 * 
 * Similar to Vue DevTools overlay.js pattern
 */
import devToolbarOptions from 'virtual:visulima-dev-toolbar-options';

// Set up globals for dev toolbar
window.__VISULIMA_DEV_TOOLBAR_OPTIONS__ = devToolbarOptions;

/**
 * Initialize the dev toolbar
 */
async function initToolbar() {
  if (typeof window === 'undefined' || window.__VISULIMA_DEVTOOLS_INITIALIZED__) {
    return;
  }

  try {
    // Import the toolbar module (registers the custom element)
    // Use .ts extension - Vite will transform TypeScript
    await import('virtual:visulima-dev-toolbar-path:toolbar/index.ts');
    
    // Import apps
    const { settingsApp, moreApp, timelineApp } = await import('virtual:visulima-dev-toolbar-path:apps/index.ts');
    
    // Create toolbar element
    const toolbar = document.createElement('dev-toolbar');
    document.body.appendChild(toolbar);
    
    // Register built-in apps
    if (toolbar.registerApp) {
      const { apps } = devToolbarOptions;
      
      if (apps.settings) {
        toolbar.registerApp(settingsApp, true);
      }
      if (apps.timeline) {
        toolbar.registerApp(timelineApp, true);
      }
      // Always register more app
      toolbar.registerApp(moreApp, true);
    }
    
    // Initialize toolbar
    if (toolbar.init) {
      toolbar.init();
    }
    
    window.__VISULIMA_DEVTOOLS_INITIALIZED__ = true;
    console.log('[dev-toolbar] Initialized successfully');
  } catch (error) {
    console.error('[dev-toolbar] Failed to initialize:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToolbar);
} else {
  initToolbar();
}

// Listen for HMR events
if (import.meta.hot) {
  import.meta.hot.on('dev-toolbar:init', () => {
    initToolbar();
  });
}

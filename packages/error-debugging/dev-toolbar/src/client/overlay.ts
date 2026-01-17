/**
 * Dev toolbar overlay loader
 * This file is loaded via virtual module and injects the toolbar into the page
 *
 * Similar to Vue DevTools overlay.js pattern
 */
import devToolbarOptions from "virtual:visulima-dev-toolbar-options";

// Set up globals for dev toolbar
globalThis.__VISULIMA_DEV_TOOLBAR_OPTIONS__ = devToolbarOptions;

/**
 * Initialize the dev toolbar.
 */
const initToolbar = async () => {
    if (globalThis.window === undefined) {
        return;
    }

    // Prevent double initialization (race condition protection)
    // Set flag immediately before async operations
    if (globalThis.__VISULIMA_DEVTOOLS_INITIALIZED__) {
        return;
    }

    globalThis.__VISULIMA_DEVTOOLS_INITIALIZED__ = true;

    try {
        // Import the toolbar module (registers the custom element)
        // Use .js extension - we're loading from dist
        await import("virtual:visulima-dev-toolbar-path:toolbar/index.js");

        // Import apps
        const { moreApp, settingsApp, timelineApp } = await import("virtual:visulima-dev-toolbar-path:apps/index.js");

        // Create toolbar element
        const toolbar = document.createElement("dev-toolbar");

        document.body.append(toolbar);

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

        console.log("[dev-toolbar] Initialized successfully");
    } catch (error) {
        // Reset flag on error so retry is possible
        globalThis.__VISULIMA_DEVTOOLS_INITIALIZED__ = false;
        console.error("[dev-toolbar] Failed to initialize:", error);
    }
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToolbar);
} else {
    initToolbar();
}

// Listen for HMR events
if (import.meta.hot) {
    import.meta.hot.on("dev-toolbar:init", () => {
        initToolbar();
    });
}

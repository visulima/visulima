/**
 * Dev toolbar overlay loader
 * This file is loaded via virtual module and injects the toolbar into the page
 *
 * Similar to Vue DevTools overlay.js pattern
 */
import devToolbarOptions from "virtual:visulima-dev-toolbar-options";

// Set up globals for dev toolbar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__VISULIMA_DEV_TOOLBAR_OPTIONS__ = devToolbarOptions;

/**
 * Check whether the URL contains the required activation flag.
 * Returns true when the toolbar is allowed to initialize.
 */
const isUrlFlagPresent = (): boolean => {
    if (!devToolbarOptions.requireUrlFlag) {
        return true;
    }

    const flagName = devToolbarOptions.urlFlagName ?? "devtools";
    const params = new URLSearchParams(globalThis.window?.location.search);

    return params.get(flagName) === "true";
};

/**
 * Initialize the dev toolbar.
 */
const initToolbar = async () => {
    if (globalThis.window === undefined) {
        return;
    }

    // Bail out when URL flag is required but not present in the current URL
    if (!isUrlFlagPresent()) {
        return;
    }

    // Prevent double initialization (race condition protection)
    // Set flag immediately before async operations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__) {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__ = true;

    try {
        // Import the toolbar module (registers the custom element)
        // Use .js extension - we're loading from dist
        await import("virtual:visulima-dev-toolbar-path:toolbar/index.js");

        // Import apps
        const { moduleGraphApp, moreApp, performanceApp, seoApp, settingsApp, timelineApp, viteConfigApp } = await import("virtual:visulima-dev-toolbar-path:apps/index.js");

        // Create toolbar element
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolbar = document.createElement("dev-toolbar") as any;

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

            if (apps.viteConfig) {
                toolbar.registerApp(viteConfigApp, true);
            }

            if (apps.moduleGraph) {
                toolbar.registerApp(moduleGraphApp, true);
            }

            if (apps.seo) {
                toolbar.registerApp(seoApp, true);
            }

            if (apps.performance) {
                toolbar.registerApp(performanceApp, true);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__ = false;
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

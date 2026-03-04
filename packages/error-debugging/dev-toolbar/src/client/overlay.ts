/**
 * Dev toolbar overlay loader
 * This file is loaded via virtual module and injects the toolbar into the page
 *
 * Similar to Vue DevTools overlay.js pattern
 */
import devToolbarOptions from "virtual:visulima-dev-toolbar-options";

// Set up globals for dev toolbar
// eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
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
 * Loads all enabled app modules in parallel.
 */

const loadAppModules = (appConfig: (typeof devToolbarOptions)["apps"]) =>
    Promise.all([
        appConfig.settings ? import("virtual:visulima-dev-toolbar-path:apps/settings/index.js") : undefined,
        appConfig.timeline ? import("virtual:visulima-dev-toolbar-path:apps/timeline/index.js") : undefined,
        appConfig.viteConfig ? import("virtual:visulima-dev-toolbar-path:apps/vite-config/index.js") : undefined,
        appConfig.moduleGraph ? import("virtual:visulima-dev-toolbar-path:apps/module-graph/index.js") : undefined,
        appConfig.seo ? import("virtual:visulima-dev-toolbar-path:apps/seo/index.js") : undefined,
        appConfig.performance ? import("virtual:visulima-dev-toolbar-path:apps/performance/index.js") : undefined,
        appConfig.a11y ? import("virtual:visulima-dev-toolbar-path:apps/a11y/index.js") : undefined,
        appConfig.inspector ? import("virtual:visulima-dev-toolbar-path:apps/inspector/index.js") : undefined,
        appConfig.tailwind ? import("virtual:visulima-dev-toolbar-path:apps/tailwind/index.js") : undefined,
        appConfig.assets ? import("virtual:visulima-dev-toolbar-path:apps/assets/index.js") : undefined,
        import("virtual:visulima-dev-toolbar-path:apps/more/index.js"),
    ]);

/**
 * Registers all loaded app modules with the toolbar element.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerApps = (toolbar: any, modules: Awaited<ReturnType<typeof loadAppModules>>) => {
    const [
        settingsModule,
        timelineModule,
        viteConfigModule,
        moduleGraphModule,
        seoModule,
        performanceModule,
        a11yModule,
        inspectorModule,
        tailwindModule,
        assetsModule,
        moreModule,
    ] = modules;

    if (!toolbar.registerApp) {
        return;
    }

    const optionalApps = [
        timelineModule,
        viteConfigModule,
        moduleGraphModule,
        seoModule,
        performanceModule,
        a11yModule,
        inspectorModule,
        tailwindModule,
        assetsModule,
    ];

    for (const appModule of optionalApps) {
        if (appModule) {
            toolbar.registerApp(appModule.default, true);
        }
    }

    // Settings last — appears at the bottom of the sidebar
    if (settingsModule) {
        toolbar.registerApp(settingsModule.default, true);
    }

    // Always register more app
    toolbar.registerApp(moreModule.default, true);
};

/**
 * Initialize the dev toolbar.
 */
const initToolbar = async (): Promise<void> => {
    if (globalThis.window === undefined) {
        return;
    }

    // Bail out when URL flag is required but not present in the current URL
    if (!isUrlFlagPresent()) {
        return;
    }

    // Prevent double initialization (race condition protection)
    // Set flag immediately before async operations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
    if ((globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__) {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
    (globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__ = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let toolbar: any;

    try {
        // Import the toolbar module (registers the custom element)
        // Use .js extension - we're loading from dist
        await import("virtual:visulima-dev-toolbar-path:toolbar/index.js");

        // Only import enabled apps — conditional dynamic imports avoid loading unused modules
        const { apps: appConfig } = devToolbarOptions;
        const modules = await loadAppModules(appConfig);

        // Create toolbar element
        toolbar = document.createElement("dev-toolbar");
        document.body.append(toolbar);

        registerApps(toolbar, modules);

        // Initialize toolbar
        if (toolbar.init) {
            toolbar.init();
        }

        console.log("[dev-toolbar] Initialized successfully");
    } catch (error) {
        // Remove any partially-mounted toolbar element to avoid a dangling custom element in the DOM
        if (toolbar?.isConnected) {
            toolbar.remove();
        }

        // Reset flag on error so retry is possible
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
        (globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__ = false;
        console.error("[dev-toolbar] Failed to initialize:", error);
    }
};

// Initialize when DOM is ready
if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initToolbar);
    } else {
        // eslint-disable-next-line unicorn/prefer-top-level-await
        initToolbar().catch(() => {
            /* ignore */
        });
    }
}

// Listen for HMR events
if (import.meta.hot) {
    import.meta.hot.on("dev-toolbar:init", () => {
        // Remove any existing toolbar element and reset the init flag so that
        // initToolbar() can perform a clean re-initialization on HMR updates.
        const existingToolbar = document.querySelector("dev-toolbar");

        if (existingToolbar) {
            existingToolbar.remove();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
        (globalThis as any).__VISULIMA_DEVTOOLS_INITIALIZED__ = false;
        initToolbar().catch(() => {
            /* ignore */
        });
    });
}

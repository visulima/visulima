import type { DevToolbarApp } from "./app";
import type { DevToolbarHook } from "./hooks";
import type { ServerFunctions } from "./rpc";
import type { ToolbarSettings } from "./toolbar";

/**
 * Global DevTools API interface
 * Exposed as window.__VISULIMA_DEVTOOLS__
 */
export interface VisulimaDevTools {
    /**
     * Clear notification for an app
     * @param appId App ID
     */
    clearNotification: (appId: string) => void;

    /**
     * Close the currently active app
     */
    closeApp: () => Promise<void>;

    /**
     * Get the currently active app ID
     * @returns Active app ID or null
     */
    getActiveApp: () => string | null;

    /**
     * Get all registered apps
     * @returns Array of app definitions
     */
    getApps: () => DevToolbarApp[];

    /**
     * Get current toolbar settings
     * @returns Toolbar settings
     */
    getSettings: () => ToolbarSettings;

    /**
     * Hide the toolbar
     */
    hide: () => void;

    /**
     * Hook instance for event subscriptions
     */
    hook: DevToolbarHook;

    /**
     * Show a notification for an app
     * @param appId App ID
     * @param level Notification level
     */
    notify: (appId: string, level: "info" | "warning" | "error") => void;

    /**
     * Open an app
     * @param appId App ID to open
     */
    openApp: (appId: string) => Promise<void>;

    /**
     * Register a custom app
     * @param app App definition
     */
    registerApp: (app: DevToolbarApp) => void;

    /**
     * RPC client for calling server functions
     */
    rpc: ServerFunctions;

    /**
     * Directly set the active state of an action button without invoking callbacks.
     * Useful for deactivating a button from async work running outside the toolbar.
     * @param appId App ID
     * @param active New active state
     */
    setAppActive: (appId: string, active: boolean) => void;

    /**
     * Show the toolbar
     */
    show: () => void;

    /**
     * Toggle toolbar visibility
     */
    toggle: () => void;

    /**
     * Unregister an app
     * @param appId App ID to unregister
     */
    unregisterApp: (appId: string) => void;

    /**
     * Update toolbar settings
     * @param settings Partial settings to update
     */
    updateSettings: (settings: Partial<ToolbarSettings>) => void;

    /**
     * Package version
     */
    version: string;
}

/**
 * Global API declaration
 */
declare global {
    interface Window {
        /**
         * Visulima DevTools global API
         */
        __VISULIMA_DEVTOOLS__?: VisulimaDevTools;
    }
}

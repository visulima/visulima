import type { DevToolbarApp } from "./app";
import type { DevToolbarHook } from "./hooks";
import type { ServerFunctions } from "./rpc";
import type { ToolbarSettings } from "./toolbar";

/**
 * Global DevTools API interface.
 * Exposed as window.__VISULIMA_DEVTOOLS__
 */
interface VisulimaDevTools {
    /**
     * Clears notification for an app.
     */
    clearNotification: (appId: string) => void;

    /**
     * Closes the currently active app.
     */
    closeApp: () => Promise<void>;

    /**
     * Gets the currently active app ID.
     */
    getActiveApp: () => string | undefined;

    /**
     * Gets all registered apps.
     */
    getApps: () => DevToolbarApp[];

    /**
     * Gets current toolbar settings.
     */
    getSettings: () => ToolbarSettings;

    /**
     * Hides the toolbar.
     */
    hide: () => void;

    /**
     * Hook instance for event subscriptions.
     */
    hook: DevToolbarHook;

    /**
     * Shows a notification for an app.
     */
    notify: (appId: string, level: "info" | "warning" | "error") => void;

    /**
     * Opens an app by ID.
     */
    openApp: (appId: string) => Promise<void>;

    /**
     * Registers a custom app.
     */
    registerApp: (app: DevToolbarApp) => void;

    /**
     * RPC client for calling server functions.
     */
    rpc: ServerFunctions;

    /**
     * Directly sets the active state of an action button without invoking callbacks.
     * Useful for deactivating a button from async work running outside the toolbar.
     */
    setAppActive: (appId: string, active: boolean) => void;

    /**
     * Shows the toolbar.
     */
    show: () => void;

    /**
     * Toggles toolbar visibility.
     */
    toggle: () => void;

    /**
     * Unregisters an app by ID.
     */
    unregisterApp: (appId: string) => void;

    /**
     * Updates toolbar settings.
     */
    updateSettings: (settings: Partial<ToolbarSettings>) => void;

    /**
     * Package version.
     */
    version: string;
}

/**
 * Global API declaration
 */
declare global {
    interface Window {
        /**
         * Visulima DevTools global API.
         */
        __VISULIMA_DEVTOOLS__?: VisulimaDevTools;
    }
}

export type { VisulimaDevTools };

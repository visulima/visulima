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
 * Global `Window` augmentation for the whole package.
 *
 * Every `declare global` this package ships must live in this one block.
 * packem's .d.ts bundler treats `global` as an ordinary identifier when
 * de-duplicating declarations, so a second `declare global` in another
 * bundled module is emitted as `declare global$1` — invalid TypeScript
 * (TS1435), and *not* suppressed by `skipLibCheck` because it is a
 * grammar error rather than a type error. That breaks every consumer's
 * build. Keep additions here rather than adding a block next to the
 * interface they relate to.
 */
declare global {
    interface Window {
        /**
         * Dev toolbar hook for library integrations.
         */
        __DEV_TOOLBAR_HOOK__?: DevToolbarHook;

        /**
         * Visulima DevTools global API.
         */
        __VISULIMA_DEVTOOLS__?: VisulimaDevTools;
    }
}

export type { VisulimaDevTools };

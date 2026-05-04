import type { DevToolbarApp, DevToolbarAppState } from "../types/app";
import { createServerHelpers } from "./helpers";

/**
 * Manages the lifecycle of all registered dev-toolbar apps.
 */
class AppManager {
    private apps = new Map<string, DevToolbarAppState>();

    private activeAppId: string | undefined = undefined;

    private initializedApps = new Set<string>();

    private appCanvases = new Map<string, { element: HTMLElement; shadowRoot: ShadowRoot }>();

    /**
     * Registers an app with the toolbar.
     * @param app App definition.
     * @param builtIn Whether this is a built-in app.
     */
    public registerApp(app: DevToolbarApp, builtIn = false): void {
        if (this.apps.has(app.id)) {
            // Clean up the previous registration so lifecycle state stays consistent.
            // Calling unregisterApp asynchronously is not feasible here (synchronous
            // API), so we perform the bookkeeping inline without invoking destroy().
            this.initializedApps.delete(app.id);
            this.appCanvases.delete(app.id);

            if (this.activeAppId === app.id) {
                this.activeAppId = undefined;
            }
        }

        const eventTarget = new EventTarget();

        const appState: DevToolbarAppState = {
            ...app,
            active: false,
            builtIn,
            eventTarget,
            notification: {
                state: false,
            },
            status: "ready",
        };

        this.apps.set(app.id, appState);
    }

    /**
     * Unregisters an app and calls its destroy hook if initialized.
     * @param appId App ID to unregister.
     */
    public async unregisterApp(appId: string): Promise<void> {
        const app = this.apps.get(appId);

        if (app?.destroy && this.initializedApps.has(appId)) {
            const canvas = this.appCanvases.get(appId);

            if (canvas) {
                try {
                    await app.destroy(canvas.shadowRoot);
                } catch (error) {
                    console.error(`[dev-toolbar] destroy() failed for app ${appId}:`, error);
                }
            }
        }

        this.apps.delete(appId);
        this.initializedApps.delete(appId);
        this.appCanvases.delete(appId);

        if (this.activeAppId === appId) {
            this.activeAppId = undefined;
        }
    }

    /**
     * Returns the app state for a given ID.
     * @param appId App ID to look up.
     * @returns App state or undefined.
     */
    public getApp(appId: string): DevToolbarAppState | undefined {
        return this.apps.get(appId);
    }

    /**
     * Returns all registered app states.
     */
    public getAllApps(): DevToolbarAppState[] {
        return [...this.apps.values()];
    }

    /**
     * Returns the currently active app state, or undefined if none is active.
     */
    public getActiveApp(): DevToolbarAppState | undefined {
        if (!this.activeAppId) {
            return undefined;
        }

        return this.apps.get(this.activeAppId);
    }

    /**
     * Toggles the active state of an app.
     * @param appId App ID to toggle.
     * @returns Whether the toggle was successful.
     */
    public async toggleApp(appId: string): Promise<boolean> {
        const app = this.apps.get(appId);

        if (!app) {
            return false;
        }

        // Action button (onClick provided) — toggle active without opening a panel
        if (app.onClick ?? app.onDeactivate) {
            const wasActive = app.active;

            app.active = !wasActive;

            if (!wasActive && app.onClick) {
                await app.onClick();
            } else if (wasActive && app.onDeactivate) {
                await app.onDeactivate();
            }

            return true;
        }

        // If already active, close it
        if (app.active) {
            return await this.closeApp(appId);
        }

        // Close current active app
        if (this.activeAppId) {
            const closed = await this.closeApp(this.activeAppId);

            if (!closed) {
                return false;
            }
        }

        // Open new app
        return await this.openApp(appId);
    }

    /**
     * Directly sets the active state of an action button without invoking callbacks.
     * Use this to deactivate a button from outside the toolbar (e.g. after async work).
     * @param appId The unique identifier of the app whose active state to change.
     * @param active New active state.
     */
    public setAppActive(appId: string, active: boolean): void {
        const app = this.apps.get(appId);

        if (app) {
            app.active = active;
        }
    }

    /**
     * Returns whether an app has already had its init() called.
     * @param appId App ID to check.
     */
    public isAppInitialized(appId: string): boolean {
        return this.initializedApps.has(appId);
    }

    /**
     * Marks an app as having been initialized.
     * @param appId App ID to mark.
     */
    public markAppInitialized(appId: string): void {
        this.initializedApps.add(appId);
    }

    /**
     * Opens an app and initializes it if necessary.
     * @param appId App ID to open.
     * @returns Whether the open was successful.
     */
    public async openApp(appId: string): Promise<boolean> {
        const app = this.apps.get(appId);

        if (!app) {
            return false;
        }

        app.active = true;
        app.status = "loading";
        this.activeAppId = appId;

        // Initialize app if canvas is ready and app hasn't been initialized yet
        if (app.init && !this.isAppInitialized(appId)) {
            try {
                const canvas = this.getAppCanvas(appId);

                if (canvas) {
                    const helpers = createServerHelpers();

                    // app.init can return void or Promise<void>
                    const initResult = app.init(canvas.shadowRoot, app.eventTarget, helpers);

                    if (initResult && typeof initResult.then === "function") {
                        await initResult;
                    }

                    this.markAppInitialized(appId);
                    app.status = "ready";
                } else {
                    // Canvas not ready yet, will be initialized on next render
                    app.status = "pending";
                }
            } catch (error) {
                console.error(`[dev-toolbar] Failed to init app ${appId}:`, error);
                app.status = "error";
                app.active = false;
                this.activeAppId = undefined;

                return false;
            }
        } else {
            app.status = "ready";
        }

        return true;
    }

    /**
     * Closes an active app.
     * @param appId App ID to close.
     * @returns Whether the close was successful.
     */
    public async closeApp(appId: string): Promise<boolean> {
        const app = this.apps.get(appId);

        if (!app?.active) {
            return false;
        }

        // Check if app wants to prevent closing
        if (app.beforeTogglingOff) {
            const canvas = this.getAppCanvas(appId);

            if (canvas) {
                try {
                    const result = app.beforeTogglingOff(canvas.shadowRoot);
                    // beforeTogglingOff can return boolean or Promise<boolean>
                    const shouldClose = result && typeof (result as Promise<boolean>).then === "function" ? await result : result;

                    if (!shouldClose) {
                        return false;
                    }
                } catch (error) {
                    // Allow close on error — better to close than to leave the app permanently stuck open
                    console.error(`[dev-toolbar] beforeTogglingOff() threw for app ${appId}:`, error);
                }
            }
        }

        app.active = false;

        if (this.activeAppId === appId) {
            this.activeAppId = undefined;
        }

        return true;
    }

    /**
     * Sets a notification for an app.
     * @param appId The unique identifier of the app to notify.
     * @param state Whether the notification is currently visible.
     * @param level The severity level of the notification badge.
     */
    public setNotification(appId: string, state: boolean, level?: "info" | "warning" | "error"): void {
        const app = this.apps.get(appId);

        if (app) {
            app.notification = { level, state };
        }
    }

    /**
     * Clears the notification for an app.
     * @param appId The unique identifier of the app whose notification to clear.
     */
    public clearNotification(appId: string): void {
        const app = this.apps.get(appId);

        if (app) {
            app.notification = { state: false };
        }
    }

    /**
     * Returns the canvas element and shadow root for an app.
     * @param appId The unique identifier of the app whose canvas to retrieve.
     * @returns Canvas element with shadow root or undefined.
     */
    public getAppCanvas(appId: string): { element: HTMLElement; shadowRoot: ShadowRoot } | undefined {
        return this.appCanvases.get(appId);
    }

    /**
     * Stores the canvas element and shadow root for an app.
     * @param appId The unique identifier of the app whose canvas to store.
     * @param canvas The canvas object containing the host element and its shadow root.
     * @param canvas.element The host HTMLElement that wraps the app's shadow DOM.
     * @param canvas.shadowRoot The ShadowRoot attached to the canvas element.
     */
    public setAppCanvas(appId: string, canvas: { element: HTMLElement; shadowRoot: ShadowRoot }): void {
        this.appCanvases.set(appId, canvas);
    }
}

export { AppManager };
export default AppManager;

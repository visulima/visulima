import type { DevToolbarApp, DevToolbarAppState, ToolbarAppEventTarget } from "../types/app";
import { createServerHelpers } from "./helpers";

/**
 * App manager for handling app lifecycle
 */
export class AppManager {
    private apps = new Map<string, DevToolbarAppState>();

    private activeAppId: string | null = null;

    private initializedApps = new Set<string>();

    private appCanvases = new Map<string, { element: HTMLElement; shadowRoot: ShadowRoot }>();

    /**
     * Register an app
     * @param app App definition
     * @param builtIn Whether this is a built-in app
     */
    registerApp(app: DevToolbarApp, builtIn = false): void {
        if (this.apps.has(app.id)) {
            // Clean up the previous registration so lifecycle state stays consistent.
            // Calling unregisterApp asynchronously is not feasible here (synchronous
            // API), so we perform the bookkeeping inline without invoking destroy().
            this.initializedApps.delete(app.id);
            this.appCanvases.delete(app.id);

            if (this.activeAppId === app.id) {
                this.activeAppId = null;
            }
        }

        const eventTarget = new EventTarget() as ToolbarAppEventTarget;

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
     * Unregister an app
     * @param appId App ID
     */
    async unregisterApp(appId: string): Promise<void> {
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
            this.activeAppId = null;
        }
    }

    /**
     * Get an app by ID
     * @param appId App ID
     * @returns App state or undefined
     */
    getApp(appId: string): DevToolbarAppState | undefined {
        return this.apps.get(appId);
    }

    /**
     * Get all apps
     * @returns Array of app states
     */
    getAllApps(): DevToolbarAppState[] {
        return [...this.apps.values()];
    }

    /**
     * Get active app
     * @returns Active app state or undefined
     */
    getActiveApp(): DevToolbarAppState | undefined {
        if (!this.activeAppId) {
            return undefined;
        }

        return this.apps.get(this.activeAppId);
    }

    /**
     * Toggle app active state
     * @param appId App ID
     * @returns Whether toggle was successful
     */
    async toggleApp(appId: string): Promise<boolean> {
        const app = this.apps.get(appId);

        if (!app) {
            return false;
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
     * Check if an app has been initialized
     * @returns True when the app's init() has already been called
     */
    isAppInitialized(appId: string): boolean {
        return this.initializedApps.has(appId);
    }

    /**
     * Mark an app as initialized
     * @returns void
     */
    markAppInitialized(appId: string): void {
        this.initializedApps.add(appId);
    }

    /**
     * Open an app
     * @param appId App ID
     * @returns Whether open was successful
     */
    async openApp(appId: string): Promise<boolean> {
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
                // eslint-disable-next-line no-console
                console.error(`[dev-toolbar] Failed to init app ${appId}:`, error);
                app.status = "error";
                app.active = false;
                this.activeAppId = null;

                return false;
            }
        } else {
            app.status = "ready";
        }

        return true;
    }

    /**
     * Close an app
     * @param appId App ID
     * @returns Whether close was successful
     */
    async closeApp(appId: string): Promise<boolean> {
        const app = this.apps.get(appId);

        if (!app || !app.active) {
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
            this.activeAppId = null;
        }

        return true;
    }

    /**
     * Set app notification
     * @param appId App ID
     * @param state Notification state
     * @param level Notification level
     */
    setNotification(appId: string, state: boolean, level?: "info" | "warning" | "error"): void {
        const app = this.apps.get(appId);

        if (app) {
            app.notification = { level, state };
        }
    }

    /**
     * Clear app notification
     * @param appId App ID
     */
    clearNotification(appId: string): void {
        const app = this.apps.get(appId);

        if (app) {
            app.notification = { state: false };
        }
    }

    /**
     * Get app canvas element
     * @param appId App ID
     * @returns Canvas element with shadow root or null
     */
    getAppCanvas(appId: string): { element: HTMLElement; shadowRoot: ShadowRoot } | null {
        return this.appCanvases.get(appId) || null;
    }

    /**
     * Set app canvas element (called by toolbar component)
     * @param appId App ID
     * @param canvas Canvas with shadow root
     */
    setAppCanvas(appId: string, canvas: { element: HTMLElement; shadowRoot: ShadowRoot }): void {
        this.appCanvases.set(appId, canvas);
    }
}

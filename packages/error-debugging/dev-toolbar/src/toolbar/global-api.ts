import { getGlobalHook } from "../hooks/index";
import { createClientRPCContext } from "../rpc/client";
import type { VisulimaDevTools } from "../types/global-api";
import type { DevToolbarApp, ToolbarSettings } from "../types/index";
import type { ServerFunctions } from "../types/rpc";
import { loadSettings, updateSettings } from "./settings";

/**
 * Creates the global DevTools API implementation.
 */
export const createGlobalAPI = (
    appManager: {
        clearNotification: (id: string) => void;
        getActiveApp: () => DevToolbarApp | undefined;
        getApps: () => DevToolbarApp[];
        registerApp: (app: DevToolbarApp) => void;
        setAppActive: (id: string, active: boolean) => void;
        setNotification: (id: string, state: boolean, level?: "info" | "warning" | "error") => void;
        toggleApp: (id: string) => Promise<boolean>;
        unregisterApp: (id: string) => void;
    },
    toolbar: { hide: () => void; show: () => void; toggle: () => void },
): VisulimaDevTools => {
    const rpcContext = createClientRPCContext();
    const hook = getGlobalHook();

    if (!hook) {
        throw new Error("Global hook not initialized");
    }

    return {
        clearNotification(appId: string): void {
            appManager.clearNotification(appId);
        },

        async closeApp(): Promise<void> {
            const activeApp = appManager.getActiveApp();

            if (activeApp) {
                await appManager.toggleApp(activeApp.id);
            }
        },

        getActiveApp(): string | undefined {
            const activeApp = appManager.getActiveApp();

            return activeApp?.id;
        },

        getApps(): DevToolbarApp[] {
            return appManager.getApps();
        },

        getSettings(): ToolbarSettings {
            return loadSettings();
        },

        hide(): void {
            toolbar.hide();
        },

        hook,

        notify(appId: string, level: "info" | "warning" | "error"): void {
            appManager.setNotification(appId, true, level);
        },

        async openApp(appId: string): Promise<void> {
            await appManager.toggleApp(appId);
        },

        registerApp(app: DevToolbarApp): void {
            appManager.registerApp(app);
        },

        rpc: new Proxy({} as ServerFunctions, {
            get(_target, prop: string) {
                return (...args: any[]) => rpcContext.callServer(prop as any, ...args);
            },
        }),

        setAppActive(appId: string, active: boolean): void {
            appManager.setAppActive(appId, active);
        },

        show(): void {
            toolbar.show();
        },

        toggle(): void {
            toolbar.toggle();
        },

        unregisterApp(appId: string): void {
            appManager.unregisterApp(appId);
        },

        updateSettings(settings: Partial<ToolbarSettings>): void {
            updateSettings(settings);
        },

        version: "0.0.0", // Will be replaced with actual version from package.json
    };
};

/**
 * Mounts the global API on the window object so it can be accessed from outside the toolbar.
 * @param api API instance to expose globally.
 */
export const setupGlobalAPI = (api: VisulimaDevTools): void => {
    if (globalThis.window !== undefined) {
        (globalThis as any).__VISULIMA_DEVTOOLS__ = api;
    }
};

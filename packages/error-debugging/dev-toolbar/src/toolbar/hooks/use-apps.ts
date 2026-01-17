import { useCallback } from "preact/hooks";

import type { DevToolbarAppState } from "../../types/index";
import { useToolbarContext } from "../context/index";

/**
 * Hook for app management
 */
export const useApps = (): {
    activeAppId: string | null;
    apps: DevToolbarAppState[];
    clearNotification: (appId: string) => void;
    registerApp: (app: DevToolbarAppState) => void;
    setNotification: (appId: string, state: boolean, level?: "info" | "warning" | "error") => void;
    toggleApp: (appId: string) => Promise<void>;
    unregisterApp: (appId: string) => void;
} => {
    const context = useToolbarContext();

    const registerApp = useCallback(
        (app: DevToolbarAppState) => {
            context.registerApp(app);
        },
        [context],
    );

    const unregisterApp = useCallback(
        (appId: string) => {
            context.unregisterApp(appId);
        },
        [context],
    );

    const toggleApp = useCallback(
        async (appId: string) => {
            await context.toggleApp(appId);
        },
        [context],
    );

    const setNotification = useCallback(
        (appId: string, state: boolean, level?: "info" | "warning" | "error") => {
            context.setNotification(appId, state, level);
        },
        [context],
    );

    const clearNotification = useCallback(
        (appId: string) => {
            context.clearNotification(appId);
        },
        [context],
    );

    return {
        apps: context.apps,
        activeAppId: context.activeAppId,
        registerApp,
        unregisterApp,
        toggleApp,
        setNotification,
        clearNotification,
    };
};

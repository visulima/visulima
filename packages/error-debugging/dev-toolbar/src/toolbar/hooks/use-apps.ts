import type { DevToolbarAppState } from "../../types/index";
import { useToolbarContext } from "../context/index";

/**
 * Hook for app management - exposes context app methods directly
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

    return {
        activeAppId: context.activeAppId,
        apps: context.apps,
        clearNotification: context.clearNotification,
        registerApp: context.registerApp,
        setNotification: context.setNotification,
        toggleApp: context.toggleApp,
        unregisterApp: context.unregisterApp,
    };
};

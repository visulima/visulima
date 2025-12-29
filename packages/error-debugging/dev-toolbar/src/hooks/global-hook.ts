import type { DevToolbarApp } from "../types/app";
import type { DevToolbarHook } from "../types/hooks";
import type { TimelineEvent } from "../types/timeline";
import { createDevToolbarHook } from "./create-hook";

let globalHookInstance: DevToolbarHook | undefined;

/**
 * Setup global hook on window object
 * @param onRegisterApp Callback when app is registered
 * @param onTimelineEvent Callback when timeline event is added
 * @returns Hook instance
 */
export const setupGlobalHook = (
    onRegisterApp?: (app: DevToolbarApp) => void,
    onTimelineEvent?: (groupId: string, event: TimelineEvent) => void,
): DevToolbarHook => {
    if (globalHookInstance) {
        return globalHookInstance;
    }

    globalHookInstance = createDevToolbarHook(onRegisterApp, onTimelineEvent);

    if (globalThis.window !== undefined) {
        globalThis.__DEV_TOOLBAR_HOOK__ = globalHookInstance;
    }

    return globalHookInstance;
};

/**
 * Get the global hook instance
 * @returns Hook instance or undefined
 */
export const getGlobalHook = (): DevToolbarHook | undefined => {
    if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
        return globalThis.__DEV_TOOLBAR_HOOK__;
    }

    return globalHookInstance;
};

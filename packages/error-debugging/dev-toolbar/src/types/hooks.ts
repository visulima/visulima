import type { DevToolbarApp } from "./app";
import type { TimelineEvent } from "./timeline";

/**
 * Hook event definitions
 */
interface HookEvents {
    // Extension point for custom events.
    [key: string]: (...args: any[]) => void;

    /**
     * App error occurred.
     * @param error Error object.
     * @param appId Optional app ID where error occurred.
     */
    "app:error": (error: Error, appId?: string) => void;

    /**
     * DevTools closed.
     */
    "devtools:close": () => void;

    /**
     * DevTools initialized.
     */
    "devtools:init": () => void;

    /**
     * DevTools opened.
     * @param appId ID of the opened app.
     */
    "devtools:open": (appId: string) => void;

    /**
     * Timeline event added.
     * @param event Timeline event.
     */
    "timeline:event": (event: TimelineEvent) => void;
}

/**
 * Dev toolbar hook interface.
 * Exposed as window.__DEV_TOOLBAR_HOOK__
 */
interface DevToolbarHook {
    /**
     * Adds a timeline event.
     * @param groupId Timeline group ID.
     * @param event Timeline event.
     */
    addTimelineEvent: (groupId: string, event: TimelineEvent) => void;

    /**
     * Emits an event.
     * @param event Event name.
     * @param args Event arguments.
     */
    emit: <T extends keyof HookEvents>(event: T, ...args: Parameters<HookEvents[T]>) => void;

    /**
     * Unsubscribes from an event.
     * @param event Event name.
     * @param handler Optional specific handler to remove.
     */
    off: <T extends keyof HookEvents>(event: T, handler?: HookEvents[T]) => void;

    /**
     * Subscribes to an event.
     * @param event Event name.
     * @param handler Event handler.
     * @returns Unsubscribe function.
     */
    on: <T extends keyof HookEvents>(event: T, handler: HookEvents[T]) => () => void;

    /**
     * Subscribes to an event once.
     * @param event Event name.
     * @param handler Event handler.
     */
    once: <T extends keyof HookEvents>(event: T, handler: HookEvents[T]) => void;

    /**
     * Registers a custom app.
     * @param app App definition.
     */
    registerApp: (app: DevToolbarApp) => void;
}

/**
 * Global hook declaration
 */
declare global {
    interface Window {
        /**
         * Dev toolbar hook for library integrations.
         */
        __DEV_TOOLBAR_HOOK__?: DevToolbarHook;
    }
}

export type { DevToolbarHook, HookEvents };

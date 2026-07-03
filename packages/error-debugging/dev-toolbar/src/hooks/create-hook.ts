import type { DevToolbarApp } from "../types/app";
import type { DevToolbarHook, HookEvents } from "../types/hooks";
import type { TimelineEvent } from "../types/timeline";

/**
 * Event handler storage.
 */
type EventHandlers = Map<keyof HookEvents, Set<HookEvents[keyof HookEvents]>>;

/**
 * Creates a dev toolbar hook instance.
 * @param onRegisterApp Callback when app is registered.
 * @param onTimelineEvent Callback when timeline event is added.
 * @returns Hook instance.
 */
const createDevToolbarHook = (
    onRegisterApp?: (app: DevToolbarApp) => void,
    onTimelineEvent?: (groupId: string, event: TimelineEvent) => void,
): DevToolbarHook => {
    const handlers: EventHandlers = new Map();

    return {
        addTimelineEvent(groupId: string, event: TimelineEvent): void {
            if (onTimelineEvent) {
                onTimelineEvent(groupId, event);
            }

            // Also emit timeline event
            this.emit("timeline:event", event);
        },

        emit<T extends keyof HookEvents>(event: T, ...args: Parameters<HookEvents[T]>): void {
            const eventHandlers = handlers.get(event);

            if (!eventHandlers) {
                return;
            }

            for (const handler of eventHandlers) {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`[dev-toolbar] Error in hook handler for ${String(event)}:`, error);
                }
            }
        },

        off<T extends keyof HookEvents>(event: T, handler?: HookEvents[T]): void {
            const eventHandlers = handlers.get(event);

            if (!eventHandlers) {
                return;
            }

            if (handler) {
                eventHandlers.delete(handler);

                if (eventHandlers.size === 0) {
                    handlers.delete(event);
                }
            } else {
                // Remove all handlers for this event
                handlers.delete(event);
            }
        },

        on<T extends keyof HookEvents>(event: T, handler: HookEvents[T]): () => void {
            if (!handlers.has(event)) {
                handlers.set(event, new Set());
            }

            handlers.get(event)!.add(handler);

            // Return unsubscribe function
            return () => {
                const eventHandlers = handlers.get(event);

                if (eventHandlers) {
                    eventHandlers.delete(handler);

                    if (eventHandlers.size === 0) {
                        handlers.delete(event);
                    }
                }
            };
        },

        once<T extends keyof HookEvents>(event: T, handler: HookEvents[T]): void {
            const onceHandler = ((...args: Parameters<HookEvents[T]>) => {
                handler(...args);
                this.off(event, onceHandler);
            }) as HookEvents[T];

            this.on(event, onceHandler);
        },

        registerApp(app: DevToolbarApp): void {
            if (onRegisterApp) {
                onRegisterApp(app);
            }
        },
    };
};

export { createDevToolbarHook };

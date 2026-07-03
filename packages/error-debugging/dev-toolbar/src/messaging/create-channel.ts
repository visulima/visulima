import type { MessageChannel } from "../types/messaging";
import type { MessageEnvelope, MessageHandler, MessageHandlers } from "./types";

/**
 * Creates a message channel implementation.
 * @param handlers Shared handlers map.
 * @param sendFunction Function to send messages.
 * @returns Message channel instance.
 */
export const createMessageChannel = <TEvents extends Record<string, (...args: any[]) => void>>(
    handlers: MessageHandlers,
    sendFunction: (event: string, ...args: any[]) => void,
): MessageChannel<TEvents> => {
    return {
        off<K extends keyof TEvents>(event: K, handler?: TEvents[K]): void {
            const eventName = String(event);
            const eventHandlers = handlers.get(eventName);

            if (!eventHandlers) {
                return;
            }

            if (handler) {
                eventHandlers.delete(handler as MessageHandler);

                if (eventHandlers.size === 0) {
                    handlers.delete(eventName);
                }
            } else {
                // Remove all handlers for this event
                handlers.delete(eventName);
            }
        },

        on<K extends keyof TEvents>(event: K, handler: TEvents[K]): () => void {
            const eventName = String(event);

            if (!handlers.has(eventName)) {
                handlers.set(eventName, new Set());
            }

            handlers.get(eventName)!.add(handler as MessageHandler);

            // Return unsubscribe function
            return () => {
                const eventHandlers = handlers.get(eventName);

                if (eventHandlers) {
                    eventHandlers.delete(handler as MessageHandler);

                    if (eventHandlers.size === 0) {
                        handlers.delete(eventName);
                    }
                }
            };
        },

        once<K extends keyof TEvents>(event: K, handler: TEvents[K]): void {
            const onceHandler = ((...args: Parameters<TEvents[K]>) => {
                handler(...args);
                this.off(event, onceHandler);
            }) as TEvents[K];

            this.on(event, onceHandler);
        },

        send<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): void {
            sendFunction(String(event), ...args);
        },
    };
};

/**
 * Handles incoming messages.
 * @param handlers Message handlers map.
 * @param envelope Message envelope containing event and data.
 */
export const handleMessage = (handlers: MessageHandlers, envelope: MessageEnvelope): void => {
    const eventHandlers = handlers.get(envelope.event);

    if (!eventHandlers || eventHandlers.size === 0) {
        return;
    }

    for (const handler of eventHandlers) {
        try {
            handler(envelope.data, envelope);
        } catch (error) {
            console.error(`[dev-toolbar] Error handling message ${envelope.event}:`, error);
        }
    }
};

import type { MessageChannel } from "../../../types/messaging";
import { createMessageChannel, handleMessage } from "../../create-channel";
import type { MessageHandlers } from "../../types";

/**
 * BroadcastChannel message events for separate window communication.
 */

export interface BroadcastChannelEvents extends Record<string, (...args: any[]) => void> {
    "dev-toolbar:message": (data: { data?: unknown; event: string; id?: string }) => void;
}

/**
 * Creates a BroadcastChannel message channel for separate window support.
 * @param channelName The name identifier for the BroadcastChannel instance.
 * @param handlers Shared handlers map.
 * @returns Message channel instance.
 */
export const createBroadcastChannel = (channelName: string, handlers: MessageHandlers): MessageChannel<BroadcastChannelEvents> => {
    if (globalThis.window === undefined || typeof BroadcastChannel === "undefined") {
        // Fallback to no-op channel if BroadcastChannel not available
        return createMessageChannel<BroadcastChannelEvents>(handlers, () => {});
    }

    const channel = new BroadcastChannel(channelName);

    // Listen for messages
    channel.addEventListener("message", (event: MessageEvent) => {
        const { data, event: eventName, id } = event.data as { data?: unknown; event: string; id?: string };

        handleMessage(handlers, {
            data,
            event: eventName,
            id,
            timestamp: Date.now(),
        });
    });

    // Create channel with send function

    const sendMessage = (event: string, ...args: any[]): void => {
        channel.postMessage({
            data: args,
            event,
            timestamp: Date.now(),
        });
    };

    return createMessageChannel<BroadcastChannelEvents>(handlers, sendMessage);
};

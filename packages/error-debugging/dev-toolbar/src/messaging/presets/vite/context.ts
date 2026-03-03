import type { MessageChannelContext } from "../../../types/messaging";
import { createMessageChannel } from "../../create-channel";
import type { MessageHandlers } from "../../types";

/**
 * Vite HMR message events for toolbar communication.
 */

export interface ViteHMREvents extends Record<string, (...args: any[]) => void> {
    "dev-toolbar:client": (data: { args: unknown[]; method: string }) => void;
    "dev-toolbar:init": () => void;
    "dev-toolbar:ready": () => void;
    "dev-toolbar:rpc": (data: { args: unknown[]; id: string; method: string }) => void;
}

/**
 * Creates Vite HMR message channel context.
 * @param handlers Shared handlers map.
 * @returns Message channel context.
 */
export const createViteHMRContext = (handlers: MessageHandlers): MessageChannelContext<ViteHMREvents> => {
    const sendMessage = (event: string, ...args: any[]): void => {
        if (globalThis.window === undefined || !import.meta.hot) {
            return;
        }

        import.meta.hot.send(`dev-toolbar:${event}`, { data: args });
    };

    return {
        createChannel() {
            return createMessageChannel<ViteHMREvents>(handlers, sendMessage);
        },
    };
};

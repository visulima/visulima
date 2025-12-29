import type { MessageChannelContext } from "../../../types/messaging";
import { createMessageChannel } from "../../create-channel";
import type { MessageHandlers } from "../../types";

/**
 * Vite HMR message events
 */
export interface ViteHMREvents extends Record<string, (...args: any[]) => void> {
    "dev-toolbar:client": (data: { args: any[]; method: string }) => void;
    "dev-toolbar:init": () => void;
    "dev-toolbar:ready": () => void;
    "dev-toolbar:rpc": (data: { args: any[]; id: string; method: string }) => void;
}

/**
 * Creates Vite HMR message channel context
 * @param handlers Shared handlers map
 * @returns Message channel context
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

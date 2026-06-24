import type { MessageChannel } from "../../../types/messaging";
import { createMessageChannel, handleMessage } from "../../create-channel";
import type { MessageHandlers } from "../../types";
import type { ViteHMREvents } from "./context";

/**
 * Creates a Vite HMR client-side message channel.
 * @param handlers Shared handlers map.
 * @returns Message channel instance.
 */
const createViteHMRClient = (handlers: MessageHandlers): MessageChannel<ViteHMREvents> => {
    // Listen for messages from server via HMR
    if (globalThis.window !== undefined && import.meta.hot) {
        import.meta.hot.on("dev-toolbar:server", (data: { data?: unknown; event: string; id?: string }) => {
            handleMessage(handlers, {
                data: data.data,
                event: data.event,
                id: data.id,
                timestamp: Date.now(),
            });
        });
    }

    // Create channel with send function

    const sendMessage = (event: string, ...args: any[]): void => {
        if (globalThis.window === undefined || !import.meta.hot) {
            return;
        }

        import.meta.hot.send("dev-toolbar:client", {
            data: args,
            event,
        });
    };

    return createMessageChannel<ViteHMREvents>(handlers, sendMessage);
};

export { createViteHMRClient };

import type { ViteDevServer, WebSocketClient } from "vite";

import type { MessageChannel } from "../../../types/messaging";
import { createMessageChannel, handleMessage } from "../../create-channel";
import type { MessageHandlers } from "../../types";
import type { ViteHMREvents } from "./context";

/**
 * Creates a Vite HMR server-side message channel.
 * @param server Vite dev server instance.
 * @param handlers Shared handlers map.
 * @returns Message channel instance.
 */
const createViteHMRServer = (server: ViteDevServer, handlers: MessageHandlers): MessageChannel<ViteHMREvents> => {
    // Listen for messages from client via WebSocket
    server.ws.on("dev-toolbar:client", (data: { data?: unknown; event: string }, _client: WebSocketClient) => {
        handleMessage(handlers, {
            data: data.data,
            event: data.event,
            timestamp: Date.now(),
        });
    });

    // Create channel with send function

    const sendMessage = (event: string, ...args: any[]): void => {
        server.ws.send({
            data: args,
            event: `dev-toolbar:${event}`,
            type: "custom",
        });
    };

    return createMessageChannel<ViteHMREvents>(handlers, sendMessage);
};

export { createViteHMRServer };

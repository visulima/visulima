import type { ViteDevServer, WebSocketClient } from 'vite';
import type { MessageChannel } from '../../../types/messaging.js';
import type { MessageHandlers } from '../../types.js';
import { createMessageChannel, handleMessage } from '../../create-channel.js';
import type { ViteHMREvents } from './context.js';

/**
 * Creates a Vite HMR server-side message channel
 * @param server - Vite dev server instance
 * @param handlers - Shared handlers map
 * @returns Message channel instance
 */
export const createViteHMRServer = (server: ViteDevServer, handlers: MessageHandlers): MessageChannel<ViteHMREvents> => {
  // Listen for messages from client via WebSocket
  server.ws.on('dev-toolbar:client', (data: { event: string; data?: any }, client: WebSocketClient) => {
    handleMessage(handlers, {
      event: data.event,
      data: data.data,
      timestamp: Date.now(),
    });
  });

  // Create channel with send function
  const sendMessage = (event: string, ...args: any[]): void => {
    server.ws.send({
      type: 'custom',
      event: `dev-toolbar:${event}`,
      data: args,
    });
  };

  return createMessageChannel<ViteHMREvents>(handlers, sendMessage);
};

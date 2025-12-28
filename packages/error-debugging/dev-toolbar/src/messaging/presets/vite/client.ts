import type { MessageChannel } from '../../../types/messaging.js';
import type { MessageHandlers } from '../../types.js';
import { createMessageChannel, handleMessage } from '../../create-channel.js';
import type { ViteHMREvents } from './context.js';

/**
 * Creates a Vite HMR client-side message channel
 * @param handlers - Shared handlers map
 * @returns Message channel instance
 */
export const createViteHMRClient = (handlers: MessageHandlers): MessageChannel<ViteHMREvents> => {
  // Listen for messages from server via HMR
  if (typeof window !== 'undefined' && import.meta.hot) {
    import.meta.hot.on('dev-toolbar:server', (data: { event: string; data?: any; id?: string }) => {
      handleMessage(handlers, {
        id: data.id,
        event: data.event,
        data: data.data,
        timestamp: Date.now(),
      });
    });
  }

  // Create channel with send function
  const sendMessage = (event: string, ...args: any[]): void => {
    if (typeof window === 'undefined' || !import.meta.hot) {
      return;
    }

    import.meta.hot.send('dev-toolbar:client', {
      event,
      data: args,
    });
  };

  return createMessageChannel<ViteHMREvents>(handlers, sendMessage);
};

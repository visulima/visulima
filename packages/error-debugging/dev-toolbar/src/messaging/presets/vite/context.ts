import type { MessageChannelContext } from '../../../types/messaging.js';
import type { MessageHandlers } from '../../types.js';
import { createMessageChannel } from '../../create-channel.js';

/**
 * Vite HMR message events
 */
export interface ViteHMREvents extends Record<string, (...args: any[]) => void> {
  'dev-toolbar:rpc': (data: { method: string; args: any[]; id: string }) => void;
  'dev-toolbar:client': (data: { method: string; args: any[] }) => void;
  'dev-toolbar:init': () => void;
  'dev-toolbar:ready': () => void;
}

/**
 * Creates Vite HMR message channel context
 * @param handlers - Shared handlers map
 * @returns Message channel context
 */
export const createViteHMRContext = (handlers: MessageHandlers): MessageChannelContext<ViteHMREvents> => {
  const sendMessage = (event: string, ...args: any[]): void => {
    if (typeof window === 'undefined' || !import.meta.hot) {
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

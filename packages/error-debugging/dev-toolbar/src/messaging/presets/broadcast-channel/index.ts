import type { MessageChannel } from '../../../types/messaging.js';
import type { MessageHandlers } from '../../types.js';
import { createMessageChannel, handleMessage } from '../../create-channel.js';

/**
 * BroadcastChannel message events
 */
export interface BroadcastChannelEvents extends Record<string, (...args: any[]) => void> {
  'dev-toolbar:message': (data: { event: string; data?: any; id?: string }) => void;
}

/**
 * Creates a BroadcastChannel message channel (for separate window support)
 * @param channelName - BroadcastChannel name
 * @param handlers - Shared handlers map
 * @returns Message channel instance
 */
export const createBroadcastChannel = (channelName: string, handlers: MessageHandlers): MessageChannel<BroadcastChannelEvents> => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    // Fallback to no-op channel if BroadcastChannel not available
    return createMessageChannel<BroadcastChannelEvents>(handlers, () => {});
  }

  const channel = new BroadcastChannel(channelName);

  // Listen for messages
  channel.addEventListener('message', (event: MessageEvent) => {
    const { event: eventName, data, id } = event.data as { event: string; data?: any; id?: string };
    handleMessage(handlers, {
      id,
      event: eventName,
      data,
      timestamp: Date.now(),
    });
  });

  // Create channel with send function
  const sendMessage = (event: string, ...args: any[]): void => {
    channel.postMessage({
      event,
      data: args,
      timestamp: Date.now(),
    });
  };

  return createMessageChannel<BroadcastChannelEvents>(handlers, sendMessage);
};

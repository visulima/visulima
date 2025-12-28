/**
 * Messaging layer exports
 */

export { createMessageChannel, handleMessage } from './create-channel.js';
export type { MessageEnvelope, MessageHandler, MessageHandlers } from './types.js';

export { createViteHMRClient } from './presets/vite/client.js';
export { createViteHMRServer } from './presets/vite/server.js';
export { createViteHMRContext } from './presets/vite/context.js';
export type { ViteHMREvents } from './presets/vite/context.js';

export { createBroadcastChannel } from './presets/broadcast-channel/index.js';
export type { BroadcastChannelEvents } from './presets/broadcast-channel/index.js';

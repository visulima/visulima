/**
 * Messaging layer exports
 */

export { createMessageChannel, handleMessage } from "./create-channel";
export type { BroadcastChannelEvents } from "./presets/broadcast-channel/index";
export { createBroadcastChannel } from "./presets/broadcast-channel/index";
export { createViteHMRClient } from "./presets/vite/client";
export type { ViteHMREvents } from "./presets/vite/context";
export { createViteHMRContext } from "./presets/vite/context";
export { createViteHMRServer } from "./presets/vite/server";
export type { MessageEnvelope, MessageHandler, MessageHandlers } from "./types";

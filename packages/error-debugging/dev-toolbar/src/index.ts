/**
 * @visulima/dev-toolbar
 * Dev toolbar for Vite applications
 */

// Main plugin export
export { devToolbar, default } from './vite-plugin.js';
export type { DevToolbarOptions } from './vite-plugin.js';

// Type exports
export type * from './types/index.js';

// Toolbar class export (for advanced usage)
export { DevToolbar } from './toolbar/index.js';

// Hook exports
export { setupGlobalHook, getGlobalHook, createDevToolbarHook } from './hooks/index.js';

// Timeline exports
export { TimelineStore, getTimelineStore } from './timeline/index.js';

// RPC exports
export { createServerRPCContext, createClientRPCContext } from './rpc/index.js';

// Settings exports
export { loadSettings, saveSettings, updateSettings } from './toolbar/settings.js';

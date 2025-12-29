/**
 * @visulima/dev-toolbar
 * Dev toolbar for Vite applications
 */

// Hook exports
export { createDevToolbarHook, getGlobalHook, setupGlobalHook } from "./hooks/index";
// RPC exports
export { createClientRPCContext, createServerRPCContext } from "./rpc/index";

// Timeline exports
export { getTimelineStore, TimelineStore } from "./timeline/index";

// Toolbar class export (for advanced usage)
export { DevToolbar } from "./toolbar/index";

// Settings exports
export { loadSettings, saveSettings, updateSettings } from "./toolbar/settings";

// Type exports
export type * from "./types/index";

// Main plugin export
export type { DevToolbarOptions } from "./vite-plugin";
export { default, devToolbar } from "./vite-plugin";

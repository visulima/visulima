import type { DevToolbarApp, ToolbarSettings } from './app.js';
import type { ServerFunctions } from './rpc.js';
import type { DevToolbarHook } from './hooks.js';

/**
 * Global DevTools API interface
 * Exposed as window.__VISULIMA_DEVTOOLS__
 */
export interface VisulimaDevTools {
  /**
   * Show the toolbar
   */
  show(): void;

  /**
   * Hide the toolbar
   */
  hide(): void;

  /**
   * Toggle toolbar visibility
   */
  toggle(): void;

  /**
   * Open an app
   * @param appId - App ID to open
   */
  openApp(appId: string): Promise<void>;

  /**
   * Close the currently active app
   */
  closeApp(): Promise<void>;

  /**
   * Get the currently active app ID
   * @returns Active app ID or null
   */
  getActiveApp(): string | null;

  /**
   * Register a custom app
   * @param app - App definition
   */
  registerApp(app: DevToolbarApp): void;

  /**
   * Unregister an app
   * @param appId - App ID to unregister
   */
  unregisterApp(appId: string): void;

  /**
   * Get all registered apps
   * @returns Array of app definitions
   */
  getApps(): DevToolbarApp[];

  /**
   * Show a notification for an app
   * @param appId - App ID
   * @param level - Notification level
   */
  notify(appId: string, level: 'info' | 'warning' | 'error'): void;

  /**
   * Clear notification for an app
   * @param appId - App ID
   */
  clearNotification(appId: string): void;

  /**
   * Get current toolbar settings
   * @returns Toolbar settings
   */
  getSettings(): ToolbarSettings;

  /**
   * Update toolbar settings
   * @param settings - Partial settings to update
   */
  updateSettings(settings: Partial<ToolbarSettings>): void;

  /**
   * RPC client for calling server functions
   */
  rpc: ServerFunctions;

  /**
   * Hook instance for event subscriptions
   */
  hook: DevToolbarHook;

  /**
   * Package version
   */
  version: string;
}

/**
 * Global API declaration
 */
declare global {
  interface Window {
    /**
     * Visulima DevTools global API
     */
    __VISULIMA_DEVTOOLS__?: VisulimaDevTools;
  }
}

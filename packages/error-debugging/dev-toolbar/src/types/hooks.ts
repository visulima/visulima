import type { DevToolbarApp } from './app.js';
import type { TimelineEvent } from './timeline.js';

/**
 * Hook event definitions
 */
export interface HookEvents {
  /**
   * DevTools initialized
   */
  'devtools:init': () => void;

  /**
   * DevTools opened
   * @param appId - ID of the opened app
   */
  'devtools:open': (appId: string) => void;

  /**
   * DevTools closed
   */
  'devtools:close': () => void;

  /**
   * App error occurred
   * @param error - Error object
   * @param appId - Optional app ID where error occurred
   */
  'app:error': (error: Error, appId?: string) => void;

  /**
   * Timeline event added
   * @param event - Timeline event
   */
  'timeline:event': (event: TimelineEvent) => void;

  /**
   * Extension point for custom events
   */
  [key: string]: (...args: any[]) => void;
}

/**
 * Dev toolbar hook interface
 * Exposed as window.__DEV_TOOLBAR_HOOK__
 */
export interface DevToolbarHook {
  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on<T extends keyof HookEvents>(event: T, handler: HookEvents[T]): () => void;

  /**
   * Subscribe to an event once
   * @param event - Event name
   * @param handler - Event handler
   */
  once<T extends keyof HookEvents>(event: T, handler: HookEvents[T]): void;

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Optional specific handler to remove
   */
  off<T extends keyof HookEvents>(event: T, handler?: HookEvents[T]): void;

  /**
   * Emit an event
   * @param event - Event name
   * @param args - Event arguments
   */
  emit<T extends keyof HookEvents>(event: T, ...args: Parameters<HookEvents[T]>): void;

  /**
   * Register a custom app
   * @param app - App definition
   */
  registerApp(app: DevToolbarApp): void;

  /**
   * Add a timeline event
   * @param groupId - Timeline group ID
   * @param event - Timeline event
   */
  addTimelineEvent(groupId: string, event: TimelineEvent): void;
}

/**
 * Global hook declaration
 */
declare global {
  interface Window {
    /**
     * Dev toolbar hook for library integrations
     */
    __DEV_TOOLBAR_HOOK__?: DevToolbarHook;
  }
}

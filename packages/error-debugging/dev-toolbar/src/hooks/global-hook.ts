import type { DevToolbarHook } from '../types/hooks.js';
import type { DevToolbarApp } from '../types/app.js';
import type { TimelineEvent } from '../types/timeline.js';
import { createDevToolbarHook } from './create-hook.js';

let globalHookInstance: DevToolbarHook | undefined;

/**
 * Setup global hook on window object
 * @param onRegisterApp - Callback when app is registered
 * @param onTimelineEvent - Callback when timeline event is added
 * @returns Hook instance
 */
export const setupGlobalHook = (
  onRegisterApp?: (app: DevToolbarApp) => void,
  onTimelineEvent?: (groupId: string, event: TimelineEvent) => void,
): DevToolbarHook => {
  if (globalHookInstance) {
    return globalHookInstance;
  }

  globalHookInstance = createDevToolbarHook(onRegisterApp, onTimelineEvent);

  if (typeof window !== 'undefined') {
    window.__DEV_TOOLBAR_HOOK__ = globalHookInstance;
  }

  return globalHookInstance;
};

/**
 * Get the global hook instance
 * @returns Hook instance or undefined
 */
export const getGlobalHook = (): DevToolbarHook | undefined => {
  if (typeof window !== 'undefined' && window.__DEV_TOOLBAR_HOOK__) {
    return window.__DEV_TOOLBAR_HOOK__;
  }
  return globalHookInstance;
};

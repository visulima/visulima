import type { HookEvents } from '../types/hooks.js';

/**
 * Hook event names
 */
export const HOOK_EVENT_NAMES: Array<keyof HookEvents> = [
  'devtools:init',
  'devtools:open',
  'devtools:close',
  'app:error',
  'timeline:event',
] as const;

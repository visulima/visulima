import type { HookEvents } from "../types/hooks";

/**
 * Hook event names
 */
export const HOOK_EVENT_NAMES: (keyof HookEvents)[] = ["devtools:init", "devtools:open", "devtools:close", "app:error", "timeline:event"] as const;

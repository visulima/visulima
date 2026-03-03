import type { HookEvents } from "../types/hooks";

/**
 * Hook event names.
 */
const HOOK_EVENT_NAMES: (keyof HookEvents)[] = ["devtools:init", "devtools:open", "devtools:close", "app:error", "timeline:event"] as const;

export { HOOK_EVENT_NAMES };
export default HOOK_EVENT_NAMES;

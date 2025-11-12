export const RECENT_ERROR_TTL_MS = 500 as const;

export const MESSAGE_TYPE: string = "visulima:vite-overlay:error" as const;
export const PLUGIN_NAME: string = "visulima-vite-overlay" as const;

export const DEFAULT_ERROR_NAME: string = "Error" as const;
export const DEFAULT_ERROR_MESSAGE: string = "Runtime error" as const;

export const CAUSE_CHAIN_DEPTH_LIMIT: number = 8 as const;

export const WEBSOCKET_MESSAGE_TYPE: string = MESSAGE_TYPE;

/**
 * @deprecated Use MESSAGE_TYPE instead
 * Kept for backward compatibility during transition period.
 */
export const PLUGIN_VERSION: string = "0.0.0" as const;

export const ERROR_SEVERITY_LEVELS: Record<string, string> = {
    CRITICAL: "critical",
    HIGH: "high",
    LOW: "low",
    MEDIUM: "medium",
} as const;

export type ErrorSeverity = (typeof ERROR_SEVERITY_LEVELS)[keyof typeof ERROR_SEVERITY_LEVELS];

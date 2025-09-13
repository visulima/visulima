/**
 * Constants for the Vite overlay plugin
 * These values control various aspects of error handling and overlay behavior.
 */

// Timing constants (in milliseconds)
export const RECENT_ERROR_TTL_MS = 500 as const;

/**
 * Time window for considering errors as "recent" duplicates.
 * Errors with the same signature within this window will be deduplicated.
 */

// Message and event constants
export const MESSAGE_TYPE = "visulima:vite-overlay:error" as const;
export const PLUGIN_NAME = "visulima-vite-overlay" as const;

/**
 * WebSocket message type for client-server error communication.
 * Used to identify error messages sent from client to dev server.
 */

// Default error values
export const DEFAULT_ERROR_NAME = "Error" as const;
export const DEFAULT_ERROR_MESSAGE = "Runtime error" as const;

/**
 * Fallback values used when error information is not available.
 * These provide consistent default behavior across the application.
 */

// Processing limits
export const CAUSE_CHAIN_DEPTH_LIMIT = 8 as const;

/**
 * Maximum depth for traversing error cause chains.
 * Prevents infinite loops and excessive processing in complex error scenarios.
 * This is particularly important for AggregateError and nested error structures.
 */

// WebSocket configuration
export const WEBSOCKET_MESSAGE_TYPE = MESSAGE_TYPE;

/**
 * @deprecated Use MESSAGE_TYPE instead
 * Kept for backward compatibility during transition period.
 */

// Plugin metadata
export const PLUGIN_VERSION = "0.0.0" as const;

/**
 * Current version of the Vite overlay plugin.
 * Used for debugging and version-specific behavior.
 */

// Error classification thresholds
export const ERROR_SEVERITY_LEVELS = {
    CRITICAL: "critical",
    HIGH: "high",
    LOW: "low",
    MEDIUM: "medium",
} as const;

/**
 * Error severity classifications for UI rendering decisions.
 * Helps determine visual styling and user experience based on error importance.
 */

export type ErrorSeverity = (typeof ERROR_SEVERITY_LEVELS)[keyof typeof ERROR_SEVERITY_LEVELS];

// Export type for external usage
export type { ErrorSeverity };

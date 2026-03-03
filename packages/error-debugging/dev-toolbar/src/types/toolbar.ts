/**
 * Toolbar placement options (for backward compatibility)
 */
export type ToolbarPlacement = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

/**
 * Notification levels
 */
export type NotificationLevel = "info" | "warning" | "error";

/**
 * Position anchor (which edge the toolbar is attached to)
 * Matches Vue DevTools positioning
 */
export type PositionAnchor = "top" | "bottom" | "left" | "right";

/**
 * Frame state - matches Vue DevTools DevToolsFrameState
 * @see https://github.com/vuejs/devtools/blob/main/packages/overlay/src/composables/state.ts
 */
export interface FrameState {
    /**
     * Horizontal position as percentage (0-100)
     */
    left: number;

    /**
     * Whether panel is open
     */
    open: boolean;

    /**
     * Which edge the toolbar is anchored to
     */
    position: PositionAnchor;

    /**
     * Vertical position as percentage (0-100)
     */
    top: number;
}

/**
 * Configuration options controlling the toolbar's initial appearance.
 */
export interface ToolbarSettings {
    /**
     * Whether toolbar is visible by default
     */
    defaultVisible: boolean;

    /**
     * Toolbar placement on screen
     */
    placement: ToolbarPlacement;

    /**
     * Whether to show notifications
     */
    showNotifications: boolean;
}

/**
 * Default toolbar settings
 */
export const DEFAULT_TOOLBAR_SETTINGS: ToolbarSettings = {
    defaultVisible: true,
    placement: "bottom-center",
    showNotifications: true,
} as const;

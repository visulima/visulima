import { createContext } from "preact";
import { useContext } from "preact/hooks";

import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";

/**
 * A tooltip that has been pinned by the user — stays visible until unpinned.
 */
export interface PinnedTooltip {
    /** The app whose tooltip is shown */
    app: DevToolbarAppState;
    /** Unique instance identifier (appId + timestamp) */
    id: string;
    /** Initial left position (viewport px) */
    initialX: number;
    /** Initial top position (viewport px) */
    initialY: number;
}

/**
 * Toolbar context state
 */
export interface ToolbarContextState {
    /**
     * All registered apps
     */
    apps: DevToolbarAppState[];

    /**
     * Currently active app ID
     */
    activeAppId: string | null;

    /**
     * Whether toolbar is visible
     */
    isVisible: boolean;

    /**
     * Toolbar placement on screen
     */
    placement: ToolbarPlacement;

    /**
     * Whether toolbar is being dragged
     */
    isDragging: boolean;

    /**
     * Set toolbar visibility
     */
    setVisible: (visible: boolean) => void;

    /**
     * Set toolbar placement
     */
    setPlacement: (placement: ToolbarPlacement) => void;

    /**
     * Set dragging state
     */
    setDragging: (dragging: boolean) => void;

    /**
     * Register an app
     */
    registerApp: (app: DevToolbarAppState) => void;

    /**
     * Unregister an app
     */
    unregisterApp: (appId: string) => void;

    /**
     * Toggle an app
     */
    toggleApp: (appId: string) => Promise<void>;

    /**
     * Set app notification
     */
    setNotification: (appId: string, state: boolean, level?: "info" | "warning" | "error") => void;

    /**
     * Clear app notification
     */
    clearNotification: (appId: string) => void;

    /**
     * Currently hovered app (has a tooltip component)
     */
    hoveredApp: DevToolbarAppState | null;

    /**
     * Viewport rect of the hovered app button (for tooltip positioning)
     */
    hoveredAppRect: DOMRect | null;

    /**
     * Set/clear the hovered app. Pass null to start the leave debounce.
     */
    setHoveredApp: (app: DevToolbarAppState | null, rect?: DOMRect | null) => void;

    /**
     * Currently pinned tooltip cards
     */
    pinnedTooltips: PinnedTooltip[];

    /**
     * Pin a tooltip at the given viewport position.
     * Multiple pins from the same app are allowed (each gets a unique id).
     */
    pinTooltip: (app: DevToolbarAppState, x: number, y: number) => void;

    /**
     * Remove a pinned tooltip by its instance id.
     */
    unpinTooltip: (id: string) => void;
}

/**
 * Toolbar context
 */
export const ToolbarContext: ReturnType<typeof createContext<ToolbarContextState | null>> = createContext<ToolbarContextState | null>(null);

/**
 * Hook to access toolbar context
 * @throws Error if used outside ToolbarContext provider
 */
export const useToolbarContext = (): ToolbarContextState => {
    const context: ToolbarContextState | null = useContext(ToolbarContext);

    if (!context) {
        throw new Error("useToolbarContext must be used within ToolbarContext provider");
    }

    return context;
};

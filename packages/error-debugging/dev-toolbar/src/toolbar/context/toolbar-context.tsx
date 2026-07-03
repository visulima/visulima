/** @jsxImportSource preact */
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
 * Shared state and actions exposed by the ToolbarContext.
 */
export interface ToolbarContextState {
    /**
     * Currently active app ID
     */
    activeAppId: string | undefined;

    /**
     * All registered apps
     */
    apps: DevToolbarAppState[];

    /**
     * Clears the notification badge for an app.
     */
    clearNotification: (appId: string) => void;

    /**
     * Currently hovered app (has a tooltip component)
     */
    hoveredApp: DevToolbarAppState | undefined;

    /**
     * Viewport rect of the hovered app button (for tooltip positioning)
     */
    hoveredAppRect: DOMRect | undefined;

    /**
     * Whether toolbar is being dragged
     */
    isDragging: boolean;

    /**
     * Whether toolbar is visible
     */
    isVisible: boolean;

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
     * Toolbar placement on screen
     */
    placement: ToolbarPlacement;

    /**
     * Registers an app with the toolbar.
     */
    registerApp: (app: DevToolbarAppState) => void;

    /**
     * Sets the dragging state.
     */
    setDragging: (dragging: boolean) => void;

    /**
     * Sets or clears the hovered app. Pass undefined to start the leave debounce.
     */
    setHoveredApp: (app: DevToolbarAppState | undefined, rect?: DOMRect) => void;

    /**
     * Sets a notification for an app.
     */
    setNotification: (appId: string, state: boolean, level?: "info" | "warning" | "error") => void;

    /**
     * Sets the toolbar placement.
     */
    setPlacement: (placement: ToolbarPlacement) => void;

    /**
     * Sets toolbar visibility.
     */
    setVisible: (visible: boolean) => void;

    /**
     * Toggles an app's active state.
     */
    toggleApp: (appId: string) => Promise<void>;

    /**
     * Removes a pinned tooltip by its instance id.
     */
    unpinTooltip: (id: string) => void;

    /**
     * Unregisters an app.
     */
    unregisterApp: (appId: string) => void;
}

/**
 * Preact context object that exposes the toolbar's shared state to all child components.
 */
export const ToolbarContext: ReturnType<typeof createContext<ToolbarContextState | undefined>> = createContext<ToolbarContextState | undefined>(undefined);

/**
 * Accesses the toolbar context, throwing if used outside a provider.
 * @throws Error if used outside ToolbarContext provider.
 */
export const useToolbarContext = (): ToolbarContextState => {
    const context: ToolbarContextState | undefined = useContext(ToolbarContext);

    if (!context) {
        throw new Error("useToolbarContext must be used within ToolbarContext provider");
    }

    return context;
};
